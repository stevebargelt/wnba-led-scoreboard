import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

export default async function globalTeardown() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = process.env.E2E_SUPABASE_EMAIL
  const password = process.env.E2E_SUPABASE_PASSWORD

  if (!supabaseUrl || !supabaseAnonKey || !email || !password) return

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: authData } = await supabase.auth.signInWithPassword({ email, password })
    if (!authData.session) return

    // Final safety-net sweep: catch any devices that fixture teardown missed
    const { data: remaining, error } = await supabase
      .from('devices')
      .delete()
      .eq('user_id', authData.session.user.id)
      .like('name', 'e2e-%')
      .select('id, name')

    if (error) {
      console.warn(`[globalTeardown] Final sweep warning: ${error.message}`)
    } else if (remaining?.length) {
      console.warn(
        `[globalTeardown] Final sweep removed ${remaining.length} e2e-* device(s) that fixture teardown missed:`
      )
      for (const d of remaining) console.warn(`  swept: id=${d.id} name=${d.name}`)
    } else {
      console.log('[globalTeardown] Final sweep: 0 orphaned e2e-* devices (clean)')
    }
  } catch (err) {
    console.warn('[globalTeardown] Teardown error (non-fatal):', err)
  }
}
