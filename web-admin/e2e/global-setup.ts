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
  console.log(`[globalSetup] QA session written to .auth/qa.json (ls key: ${lsKey})`)

  // Sweep orphaned e2e-* devices from crashed prior runs (ON DELETE CASCADE handles child rows)
  const { data: swept, error: sweepError } = await supabase
    .from('devices')
    .delete()
    .eq('user_id', session.user.id)
    .like('name', 'e2e-%')
    .select('id, name')

  if (sweepError) {
    console.warn(`[globalSetup] e2e-* sweep warning: ${sweepError.message}`)
  } else {
    console.log(`[globalSetup] Swept ${swept?.length ?? 0} orphaned e2e-* device(s)`)
    if (swept?.length) {
      for (const d of swept) console.log(`  swept: id=${d.id} name=${d.name}`)
    }
  }
}
