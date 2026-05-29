import { test as base } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

export type SeededDevice = { id: string; name: string }
type MyFixtures = { seededDevice: SeededDevice }

export const test = base.extend<MyFixtures>({
  seededDevice: async ({}, use) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const email = process.env.E2E_SUPABASE_EMAIL!
    const password = process.env.E2E_SUPABASE_PASSWORD!

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (authError || !authData.session) {
      throw new Error(`Fixture QA login failed: ${authError?.message ?? 'no session'}`)
    }

    const userId = authData.session.user.id
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const name = `e2e-fixture-${suffix}`

    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .insert({ name, user_id: userId })
      .select('id')
      .single()

    if (deviceError || !deviceData) {
      throw new Error(`Fixture device seeding failed: ${deviceError?.message ?? 'no data'}`)
    }

    const device: SeededDevice = { id: deviceData.id, name }
    await use(device)

    // Teardown: delete the seeded device (ON DELETE CASCADE removes child rows)
    const { error: delError } = await supabase.from('devices').delete().eq('id', device.id)
    if (delError) {
      console.warn(
        `[fixture:seededDevice] Could not delete device ${device.id}: ${delError.message}`
      )
    } else {
      console.log(`[fixture:seededDevice] Deleted device id=${device.id} name=${device.name}`)
    }
  },
})

export { expect } from '@playwright/test'
