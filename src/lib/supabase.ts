import { createClient } from '@supabase/supabase-js'

const defaultSupabaseUrl = 'https://wuvgoqjxvnbihwiijzfb.supabase.co'
const defaultSupabasePublishableKey =
  'sb_publishable_XwfSIwlW4c35Ejv4nwG6Dg_LkXaK4Z_'

export const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? defaultSupabaseUrl
export const supabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  defaultSupabasePublishableKey

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
