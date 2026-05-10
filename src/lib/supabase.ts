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
// Nur GETs (string-URL) bekommen einen URL-Cachebuster + no-cache-Header,
// damit Browser/Disk-Cache zwingend revalidieren. POST/PUT/PATCH (Insert/
// Update/RPC, Auth) lassen wir unangetastet — Request-Bodies als Stream
// lassen sich nicht zuverlaessig umpacken.
// Realtime laeuft via WebSocket und ist davon nicht betroffen.
const noCacheFetch: typeof fetch = (input, init) => {
  const method = (init?.method ?? 'GET').toUpperCase()
  const isGet = method === 'GET' && (typeof input === 'string' || input instanceof URL)

  if (!isGet) {
    // Nicht-GET: nur cache-mode setzen, keine URL/Header anfassen.
    return fetch(input, { ...init, cache: 'no-store' })
  }

  const baseUrl = typeof input === 'string' ? input : (input as URL).href
  const sep = baseUrl.includes('?') ? '&' : '?'
  const bustedUrl = `${baseUrl}${sep}_t=${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const headers = new Headers(init?.headers)
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  headers.set('Pragma', 'no-cache')

  return fetch(bustedUrl, {
    ...init,
    cache: 'no-store',
    headers,
  })
}

export const supabase = createClient(validUrl, validKey, {
  global: { fetch: noCacheFetch },
})
