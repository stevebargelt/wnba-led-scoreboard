import { createClient, SupabaseClient } from '@supabase/supabase-js'

export async function getSupabaseClient(): Promise<SupabaseClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

export async function cleanupTestData(supabase: SupabaseClient, tables: string[]): Promise<void> {
  for (const table of tables) {
    await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }
}

export async function seedTestDevice(
  supabase: SupabaseClient,
  deviceData: {
    id: string
    name: string
    owner_id: string
  }
): Promise<void> {
  const { error } = await supabase.from('devices').insert(deviceData)

  if (error) {
    throw new Error(`Failed to seed test device: ${error.message}`)
  }
}

export async function deleteTestDevice(supabase: SupabaseClient, deviceId: string): Promise<void> {
  const { error } = await supabase.from('devices').delete().eq('id', deviceId)

  if (error) {
    throw new Error(`Failed to delete test device: ${error.message}`)
  }
}
