// Minimal Supabase Edge Function to publish a device command to Realtime
// Deploy with Supabase CLI: supabase functions deploy publish-command
// Invoke with REST including JSON body: { device_id, type, payload }
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req: Request) => {
  try {
    const { device_id, type, payload } = await req.json();
    if (!device_id || !type) {
      return new Response(JSON.stringify({ error: "device_id and type required" }), { status: 400 });
    }
    const url = Deno.env.get("SUPABASE_REALTIME_URL");
    const apikey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !apikey) {
      return new Response(JSON.stringify({ error: "Missing env (SUPABASE_REALTIME_URL, SUPABASE_ANON_KEY)" }), { status: 500 });
    }
    const topic = `device:${device_id}`;
    // Phoenix websocket messages can also be sent over HTTP via the Realtime REST relay (if enabled)
    // Here, for simplicity, we open a short-lived websocket to broadcast.
    // In production, prefer a shared long-lived connection or server-side SDK.
    const wsUrl = new URL(url);
    wsUrl.searchParams.set("apikey", apikey);
    wsUrl.searchParams.set("vsn", "1.0.0");

    const ws = new WebSocket(wsUrl.toString(), ["phoenix"]);
    await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
    const send = (msg: unknown) => ws.send(JSON.stringify(msg));
    let ref = 1;
    // join topic
    send({ topic, event: "phx_join", payload: {}, ref: String(ref++) });
    // broadcast
    send({ topic, event: "broadcast", payload: { type, payload: payload ?? {} }, ref: String(ref++) });
    ws.close();
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});

