// Edge Function: on-config-write
// Validates and stores a device config, then publishes APPLY_CONFIG to device:<id> via Realtime.
// Deploy: supabase functions deploy on-config-write
// Env required:
//  - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (for DB write)
//  - SUPABASE_REALTIME_URL, SUPABASE_ANON_KEY (for Realtime broadcast)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ConfigContent = Record<string, unknown>;

function isValidConfig(content: ConfigContent): boolean {
  // Minimal validation: favorites array and nested objects exist
  if (!content || typeof content !== 'object') return false;
  const favs = (content as any).favorites;
  if (!Array.isArray(favs)) return false;
  // Optional: ensure width/height if matrix present
  const matrix = (content as any).matrix;
  if (matrix && (typeof matrix.width !== 'number' || typeof matrix.height !== 'number')) return false;
  return true;
}

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const body = await req.json();
    const device_id: string = body?.device_id;
    const content: ConfigContent = body?.content;
    const author_user_id: string | undefined = body?.author_user_id;
    if (!device_id || !content) {
      return new Response(JSON.stringify({ error: 'device_id and content required' }), { status: 400 });
    }
    if (!isValidConfig(content)) {
      return new Response(JSON.stringify({ error: 'invalid content shape' }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const rtUrl = Deno.env.get('SUPABASE_REALTIME_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey || !rtUrl || !anon) {
      return new Response(JSON.stringify({ error: 'Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_REALTIME_URL, SUPABASE_ANON_KEY' }), { status: 500 });
    }

    // Store config row
    const supabase = createClient(supabaseUrl, serviceKey);
    const { error } = await supabase.from('configs').insert({ device_id, content, source: 'cloud', author_user_id }).select().single();
    if (error) {
      return new Response(JSON.stringify({ error: String(error.message) }), { status: 500 });
    }

    // Publish APPLY_CONFIG to device:<id>
    const topic = `device:${device_id}`;
    const wsUrl = new URL(rtUrl);
    wsUrl.searchParams.set('apikey', anon);
    wsUrl.searchParams.set('vsn', '1.0.0');
    const ws = new WebSocket(wsUrl.toString(), ['phoenix']);
    await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
    const send = (msg: unknown) => ws.send(JSON.stringify(msg));
    let ref = 1;
    send({ topic, event: 'phx_join', payload: {}, ref: String(ref++) });
    send({ topic, event: 'broadcast', payload: { type: 'APPLY_CONFIG', payload: content }, ref: String(ref++) });
    ws.close();
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});

