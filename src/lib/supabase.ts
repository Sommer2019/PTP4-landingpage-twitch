import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set – Supabase disabled.')
}

// Fallback-Werte verhindern einen Crash wenn die Env-Variablen fehlen
const validUrl = supabaseUrl || 'https://placeholder.supabase.co'
const validKey = supabaseAnonKey || 'placeholder'

// Browser darf REST-Antworten von Supabase NICHT aus dem HTTP-Cache liefern.
// `cache: 'no-store'` reicht hier: der eigentliche Cache-Verursacher war ein
// Service Worker, der ist im public/service-worker.js gefixt.
// Custom Request-Header (Cache-Control/Pragma) sind hier KEINE Option, weil
// sie einen CORS-Preflight ausloesen, den die Supabase Edge Functions in
// Access-Control-Allow-Headers nicht erlauben.
const noCacheFetch: typeof fetch = (input, init) =>
    fetch(input, { ...init, cache: 'no-store' })

export const supabase = createClient(validUrl, validKey, {
  global: { fetch: noCacheFetch },
})
