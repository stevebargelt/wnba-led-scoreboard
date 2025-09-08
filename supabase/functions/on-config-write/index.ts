// Edge Function: on-config-write
// Validates and stores a device config, then publishes APPLY_CONFIG to device:<id> via Realtime.
// Deploy: supabase functions deploy on-config-write
// Env required:
//  - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (for DB write)
//  - SUPABASE_REALTIME_URL, SUPABASE_ANON_KEY (for Realtime broadcast)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Ajv2020 from "https://esm.sh/ajv@8.12.0/dist/2020";

type ConfigContent = Record<string, unknown>;

// JSON Schema mirroring schemas/config.schema.json in this repo
const CONFIG_SCHEMA: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://example.com/wnba-led-scoreboard/config.schema.json",
  title: "WNBA LED Scoreboard Config",
  type: "object",
  properties: {
    favorites: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          id: { type: ["string", "null"] },
          abbr: { type: ["string", "null"] }
        },
        required: ["name"],
        additionalProperties: false
      }
    },
    timezone: { type: "string" },
    matrix: {
      type: "object",
      properties: {
        width: { type: "integer", minimum: 1 },
        height: { type: "integer", minimum: 1 },
        chain_length: { type: "integer", minimum: 1 },
        parallel: { type: "integer", minimum: 1 },
        gpio_slowdown: { type: "integer", minimum: 0 },
        hardware_mapping: { type: "string" },
        brightness: { type: "integer", minimum: 1, maximum: 100 },
        pwm_bits: { type: "integer", minimum: 1, maximum: 16 }
      },
      required: ["width", "height"],
      additionalProperties: true
    },
    refresh: {
      type: "object",
      properties: {
        pregame_sec: { type: "integer", minimum: 1 },
        ingame_sec: { type: "integer", minimum: 1 },
        final_sec: { type: "integer", minimum: 1 }
      },
      additionalProperties: true
    },
    render: {
      type: "object",
      properties: {
        live_layout: { type: "string", enum: ["stacked", "big-logos"] },
        logo_variant: { type: "string", enum: ["mini", "banner"] }
      },
      additionalProperties: true
    }
  },
  required: ["favorites"],
  additionalProperties: true
};

const ajv = new Ajv2020({ allErrors: true });
const validateConfig = ajv.compile(CONFIG_SCHEMA);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    const body = await req.json();
    const device_id: string = body?.device_id;
    const content: ConfigContent = body?.content;
    const author_user_id: string | undefined = body?.author_user_id;
    if (!device_id || !content) {
      return new Response(JSON.stringify({ error: 'device_id and content required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Deep merge helper: replace arrays (favorites), merge objects, preserve base when patch missing
    const deepMerge = (base: any, patch: any) => {
      if (Array.isArray(base) && Array.isArray(patch)) return patch;
      if (base && typeof base === 'object' && patch && typeof patch === 'object') {
        const out: any = { ...base };
        for (const k of Object.keys(patch)) out[k] = deepMerge(base[k], patch[k]);
        return out;
      }
      return patch !== undefined ? patch : base;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anon = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey || !anon) {
      return new Response(JSON.stringify({ error: 'Missing env: SUPABASE_URL, SERVICE_ROLE_KEY, ANON_KEY' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate caller ownership using anon client with Authorization header
    const authHeader = req.headers.get('Authorization') ?? '';
    const authClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: owned, error: ownErr } = await authClient
      .from('devices')
      .select('id')
      .eq('id', device_id)
      .limit(1)
      .maybeSingle();
    if (ownErr || !owned) {
      return new Response(JSON.stringify({ error: 'Device not found or not owned by user' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Merge with last known config to preserve unspecified keys
    const reader = createClient(supabaseUrl, anon);
    const { data: lastCfg } = await reader
      .from('configs')
      .select('content, version_ts')
      .eq('device_id', device_id)
      .order('version_ts', { ascending: false })
      .limit(1)
      .maybeSingle();
    const DEFAULTS = {
      timezone: 'America/Los_Angeles',
      matrix: { width: 64, height: 32, chain_length: 1, parallel: 1, gpio_slowdown: 2, hardware_mapping: 'adafruit-hat', brightness: 80, pwm_bits: 11 },
      refresh: { pregame_sec: 30, ingame_sec: 5, final_sec: 60 },
      render: { live_layout: 'stacked', logo_variant: 'mini' }
    } as Record<string, unknown>;
    const baseContent = (lastCfg?.content as any) || DEFAULTS;
    const merged = deepMerge(baseContent, content);
    const valid = validateConfig(merged);
    if (!valid) {
      return new Response(JSON.stringify({ error: 'invalid content', details: validateConfig.errors }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Store merged config row with service role
    const supabase = createClient(supabaseUrl, serviceKey);
    const { error } = await supabase.from('configs').insert({ device_id, content: merged, source: 'cloud', author_user_id }).select().single();
    if (error) {
      return new Response(JSON.stringify({ error: String(error.message) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Publish APPLY_CONFIG to device:<id>
    const topic = `realtime:device:${device_id}`;
    // Build Realtime websocket URL from SUPABASE_URL
    const rtBase = supabaseUrl.replace('https://', 'wss://').replace(/\/$/, '') + '/realtime/v1/websocket';
    const wsUrl = new URL(rtBase);
    wsUrl.searchParams.set('apikey', anon);
    wsUrl.searchParams.set('vsn', '1.0.0');
    const ws = new WebSocket(wsUrl.toString(), ['phoenix']);
    await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
    const send = (msg: unknown) => ws.send(JSON.stringify(msg));
    let ref = 1;
    send({ topic, event: 'phx_join', payload: {}, ref: String(ref++) });
    send({ topic, event: 'broadcast', payload: { event: 'APPLY_CONFIG', payload: merged }, ref: String(ref++) });
    ws.close();
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
