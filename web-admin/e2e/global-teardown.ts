import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

export default async function globalTeardown() {
  const authDir = path.resolve(__dirname, '../.auth')
  const idFile = path.join(authDir, 'e2e-device-id.txt')

  if (!fs.existsSync(idFile)) return

  const deviceId = fs.readFileSync(idFile, 'utf-8').trim()
  if (!deviceId) return

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = process.env.E2E_SUPABASE_EMAIL
  const password = process.env.E2E_SUPABASE_PASSWORD

  if (!supabaseUrl || !supabaseAnonKey || !email || !password) return

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    await supabase.auth.signInWithPassword({ email, password })
    const { error } = await supabase.from('devices').delete().eq('id', deviceId)
    if (error) {
      console.warn(`[globalTeardown] Could not delete device ${deviceId}: ${error.message}`)
    } else {
      console.log(`[globalTeardown] Deleted seeded device id=${deviceId}`)
    }
  } catch (err) {
    console.warn(`[globalTeardown] Teardown error (non-fatal):`, err)
  } finally {
    try {
      fs.unlinkSync(idFile)
    } catch {}
  }
}
