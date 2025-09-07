// Edge Function: mint-device-token
// Issues a device-scoped JWT with a device_id claim so the agent can pass RLS checks.
// Auth: must be called by a signed-in user who owns the target device (owner_user_id).
// Deploy: supabase functions deploy mint-device-token
// Env required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const encoder = new TextEncoder();

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const { device_id, ttl_days } = await req.json();
    if (!device_id) return new Response(JSON.stringify({ error: 'device_id required' }), { status: 400 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    // Supabase forbids secrets that start with SUPABASE_; use JWT_SECRET (fallback to SUPABASE_JWT_SECRET if present)
    const jwtSecret = Deno.env.get('JWT_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET');
    if (!supabaseUrl || !anon || !jwtSecret) {
      return new Response(JSON.stringify({ error: 'Missing env (SUPABASE_URL, SUPABASE_ANON_KEY, JWT_SECRET)' }), { status: 500 });
    }

    // Authenticate caller (user) by forwarding Authorization header to Supabase
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    const userId = userData.user.id;

    // Verify ownership of device
    const { data: dev, error: devErr } = await supabase
      .from('devices')
      .select('id')
      .eq('id', device_id)
      .eq('owner_user_id', userId)
      .maybeSingle();
    if (devErr || !dev) {
      return new Response(JSON.stringify({ error: 'Device not found or not owned by user' }), { status: 403 });
    }

    const exp = getNumericDate((ttl_days ? Number(ttl_days) : 30) * 24 * 60 * 60); // default 30 days
    // Use role 'authenticated' to align with Supabase's DB roles
    const payload = { device_id, role: 'authenticated', exp, iss: 'supabase' } as Record<string, unknown>;
    const header: Record<string, string> = { alg: 'HS256', typ: 'JWT' };
    const key = await crypto.subtle.importKey('raw', encoder.encode(jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const token = await create(header, payload, key);

    return new Response(JSON.stringify({ token, exp }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
