// Edge Function: on-config-build
// Builds a JSON config from DB favorites (device_sport_config) merged with latest base config
// and optionally applies it to the device (inserts into public.configs and broadcasts APPLY_CONFIG).
// Deploy: supabase functions deploy on-config-build
// Env required:
//  - SUPABASE_URL, SERVICE_ROLE_KEY (for DB read/write)
//  - ANON_KEY or SUPABASE_ANON_KEY (for Realtime broadcast)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Ajv2020 from "https://esm.sh/ajv@8.12.0/dist/2020";

type ConfigContent = Record<string, unknown>;

// Config schema (permissive for additional properties) – requires sports array, favorites optional.
const CONFIG_SCHEMA: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://example.com/wnba-led-scoreboard/config.schema.json",
  title: "WNBA LED Scoreboard Config",
  type: "object",
  properties: {
    timezone: { type: "string" },
    matrix: { type: "object" },
    refresh: { type: "object" },
    render: { type: "object" },
    sports: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          sport: { type: "string", minLength: 1 },
          enabled: { type: "boolean" },
          priority: { type: "integer", minimum: 1 },
          favorites: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                id: { type: ["string", "null"] },
                abbr: { type: ["string", "null"] },
              },
              required: ["name"],
              additionalProperties: false,
            },
          },
        },
        required: ["sport", "enabled", "priority"],
        additionalProperties: false,
      },
    },
    favorites: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          id: { type: ["string", "null"] },
          abbr: { type: ["string", "null"] },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  required: ["sports"],
  additionalProperties: true,
};

const ajv = new Ajv2020({ allErrors: true });
const validateConfig = ajv.compile(CONFIG_SCHEMA);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    const body = await req.json();
    const device_id: string = body?.device_id;
    const apply: boolean = Boolean(body?.apply ?? true);
    if (!device_id) {
      return new Response(JSON.stringify({ error: "device_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anon = Deno.env.get("ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anon) {
      return new Response(JSON.stringify({ error: "Missing env: SUPABASE_URL, SERVICE_ROLE_KEY, ANON_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user auth and device ownership using anon client + Authorization header
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: owned, error: ownErr } = await userClient
      .from("devices")
      .select("id")
      .eq("id", device_id)
      .limit(1)
      .maybeSingle();
    if (ownErr || !owned) {
      return new Response(JSON.stringify({ error: "Device not found or not owned by user" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for reads/writes
    const admin = createClient(supabaseUrl, serviceKey);

    // Load latest base config
    const DEFAULTS = {
      timezone: "America/Los_Angeles",
      matrix: { width: 64, height: 32, chain_length: 1, parallel: 1, gpio_slowdown: 2, hardware_mapping: "adafruit-hat", brightness: 80, pwm_bits: 11 },
      refresh: { pregame_sec: 30, ingame_sec: 5, final_sec: 60 },
      render: { live_layout: "stacked", logo_variant: "mini" },
    } as Record<string, unknown>;
    const { data: lastCfg } = await admin
      .from("configs")
      .select("content, version_ts")
      .eq("device_id", device_id)
      .order("version_ts", { ascending: false })
      .limit(1)
      .maybeSingle();
    const baseContent = (lastCfg?.content as any) || DEFAULTS;

    // Load per-sport favorites (device_sport_config)
    const { data: dsc, error: dscErr } = await admin
      .from("device_sport_config")
      .select("sport, enabled, priority, favorite_teams")
      .eq("device_id", device_id)
      .order("priority", { ascending: true });
    if (dscErr) {
      return new Response(JSON.stringify({ error: dscErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load sport teams to resolve identifiers -> {id,name,abbreviation}
    const { data: teams } = await admin
      .from("sport_teams")
      .select("sport, external_id, name, display_name, abbreviation");
    const bySport = new Map<string, any[]>();
    for (const row of teams || []) {
      const s = String(row.sport);
      if (!bySport.has(s)) bySport.set(s, []);
      (bySport.get(s)!).push({
        id: String(row.external_id),
        name: (row.display_name || row.name) as string,
        abbr: String(row.abbreviation || ""),
      });
    }

    const resolveTeam = (sport: string, ident: string) => {
      const list = bySport.get(sport) || [];
      const idStr = String(ident);
      let mt = list.find((t: any) => t.id === idStr);
      if (!mt) mt = list.find((t: any) => t.abbr.toUpperCase() === idStr.toUpperCase());
      if (!mt) mt = list.find((t: any) => t.name.toLowerCase() === idStr.toLowerCase());
      return mt || { id: idStr, name: idStr, abbr: idStr };
    };

    const sportsArray = (dsc || []).map((row: any) => ({
      sport: String(row.sport),
      enabled: !!row.enabled,
      priority: Number(row.priority || 1),
      favorites: Array.isArray(row.favorite_teams)
        ? row.favorite_teams.map((v: any) => {
            const t = resolveTeam(String(row.sport), String(v));
            return { name: t.name, id: t.id, abbr: t.abbr };
          })
        : [],
    }));

    // Legacy favorites for schema compatibility: use first enabled sport by priority
    const highest = sportsArray.filter(s => s.enabled).sort((a, b) => a.priority - b.priority)[0];
    const legacyFavorites = highest ? highest.favorites : [];

    // Merge base + synthesized sports and legacy favorites
    const merged: any = {
      ...baseContent,
      favorites: legacyFavorites,
      sports: sportsArray,
    };

    // Optionally apply: insert into configs and broadcast APPLY_CONFIG
    if (apply) {
      const valid = validateConfig(merged);
      if (!valid) {
        return new Response(JSON.stringify({ error: "invalid content", details: validateConfig.errors }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await admin
        .from("configs")
        .insert({ device_id, content: merged, source: "cloud", author_user_id: userData.user.id })
        .select()
        .single();
      if (error) {
        return new Response(JSON.stringify({ error: String(error.message) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Broadcast to device via Realtime
      const topic = `realtime:device:${device_id}`;
      const rtBase = supabaseUrl.replace("https://", "wss://").replace(/\/$/, "") + "/realtime/v1/websocket";
      const wsUrl = new URL(rtBase);
      wsUrl.searchParams.set("apikey", anon);
      wsUrl.searchParams.set("vsn", "1.0.0");
      const ws = new WebSocket(wsUrl.toString(), ["phoenix"]);
      await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
      const send = (msg: unknown) => ws.send(JSON.stringify(msg));
      let ref = 1;
      send({ topic, event: "phx_join", payload: {}, ref: String(ref++) });
      send({ topic, event: "broadcast", payload: { event: "APPLY_CONFIG", payload: merged }, ref: String(ref++) });
      ws.close();
    }

    return new Response(JSON.stringify({ ok: true, applied: !!apply, content: merged }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
