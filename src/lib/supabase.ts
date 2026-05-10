import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set – Supabase disabled.')
}

// Fallback-Werte verhindern einen Crash wenn die Env-Variablen fehlen
const validUrl = supabaseUrl || 'https://placeholder.supabase.co'
const validKey = supabaseAnonKey || 'placeholder'

// Browser darf REST-Antworten von Supabase NICHT cachen — sonst zeigen
// Mod-Aenderungen (Rewards aktivieren/deaktivieren, neuer Reward) erst nach
// "Cookies & Websitedaten loeschen" auf.
//
// PostgREST behandelt unbekannte Query-Params als Spaltenfilter, d.h. ein
// URL-Cachebuster (z.B. `_t=...`) ist nicht moeglich. Wir setzen daher
// ausschliesslich:
//   - `cache: 'no-store'`   → Fetch-API-Bypass des HTTP-Caches
//   - `Cache-Control` und `Pragma` Request-Header → erzwingen Revalidierung
// Realtime laeuft via WebSocket und ist davon nicht betroffen.
const noCacheFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers)
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  }
  if (!headers.has('Pragma')) headers.set('Pragma', 'no-cache')

  return fetch(input, {
    ...init,
    cache: 'no-store',
    headers,
  })
}

export const supabase = createClient(validUrl, validKey, {
  global: { fetch: noCacheFetch },
})
