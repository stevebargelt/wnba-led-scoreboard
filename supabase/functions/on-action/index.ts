// Edge Function: onAction
// Publishes a command (type + payload) to a device Realtime channel `device:<id>`.
// Deploy: supabase functions deploy on-action
// Env required: SUPABASE_REALTIME_URL, SUPABASE_ANON_KEY
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }
    const { device_id, type, payload } = await req.json();
    if (!device_id || !type) {
      return new Response(JSON.stringify({ error: 'device_id and type required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Derive Realtime URL from SUPABASE_URL; use built-in envs to avoid forbidden SUPABASE_* secret names
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const apikey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !apikey) {
      return new Response(JSON.stringify({ error: 'Missing env (SUPABASE_URL or ANON_KEY/SUPABASE_ANON_KEY)' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const topic = `realtime:device:${device_id}`;

    // Build Realtime websocket URL from SUPABASE_URL
    const rtBase = supabaseUrl.replace('https://', 'wss://').replace(/\/$/, '') + '/realtime/v1/websocket';
    const wsUrl = new URL(rtBase);
    wsUrl.searchParams.set('apikey', apikey);
    wsUrl.searchParams.set('vsn', '1.0.0');

    const ws = new WebSocket(wsUrl.toString(), ['phoenix']);
    await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
    const send = (msg: unknown) => ws.send(JSON.stringify(msg));
    let ref = 1;
    send({ topic, event: 'phx_join', payload: {}, ref: String(ref++) });
    send({ topic, event: 'broadcast', payload: { type, payload: payload ?? {} }, ref: String(ref++) });
    ws.close();
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
