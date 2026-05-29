import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

export default async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = process.env.E2E_SUPABASE_EMAIL
  const password = process.env.E2E_SUPABASE_PASSWORD

  if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
    throw new Error(
      'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, E2E_SUPABASE_EMAIL, E2E_SUPABASE_PASSWORD'
    )
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(`QA login failed: ${error?.message ?? 'no session returned'}`)
  }

  const session = data.session
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const lsKey = `sb-${projectRef}-auth-token`

  const authDir = path.resolve(__dirname, '../.auth')
  fs.mkdirSync(authDir, { recursive: true })

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:3000',
        localStorage: [
          {
            name: lsKey,
            value: JSON.stringify(session),
          },
        ],
      },
    ],
  }

  fs.writeFileSync(path.join(authDir, 'qa.json'), JSON.stringify(storageState, null, 2))

  // Seed a device fixture so the spec can assert it appears in the list
  const { data: deviceData, error: deviceError } = await supabase
    .from('devices')
    .insert({ name: 'e2e-smoke-device', user_id: session.user.id })
    .select('id')
    .single()

  if (deviceError || !deviceData) {
    throw new Error(`Device seeding failed: ${deviceError?.message ?? 'no data returned'}`)
  }

  fs.writeFileSync(path.join(authDir, 'e2e-device-id.txt'), deviceData.id)

  console.log(`[globalSetup] QA session written to .auth/qa.json (ls key: ${lsKey})`)
  console.log(`[globalSetup] Seeded device id=${deviceData.id}`)
}
