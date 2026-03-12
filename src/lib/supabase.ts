import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set – Supabase disabled.')
}

// Fallback to avoid crash if env vars missing
const validUrl = supabaseUrl || 'https://placeholder.supabase.co'
const validKey = supabaseAnonKey || 'placeholder'

export const supabase = createClient(validUrl, validKey)
