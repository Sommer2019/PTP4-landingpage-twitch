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
// `cache: 'no-store'` allein reicht nicht — manche Browser (Safari/Firefox)
// bedienen GETs trotzdem aus dem Disk-Cache, wenn die Antwort keine
// expliziten no-store-Header hat. Daher zusaetzlich:
//   1. URL-Cachebuster (`_t=<timestamp>`) → eindeutiger Cache-Key pro Request
//   2. Request-Header `Cache-Control: no-cache, no-store, must-revalidate`
//      und `Pragma: no-cache` → erzwingt Revalidierung beim Origin
// Realtime laeuft via WebSocket und ist davon nicht betroffen.
const noCacheFetch: typeof fetch = (input, init) => {
  // URL extrahieren, egal ob string | URL | Request
  let url: string
  let baseInit: RequestInit | undefined = init
  if (typeof input === 'string') {
    url = input
  } else if (input instanceof URL) {
    url = input.href
  } else {
    url = input.url
    // Bei Request-Objekt init aus dem Request uebernehmen, falls nicht ueberschrieben
    if (!baseInit) {
      baseInit = {
        method: input.method,
        headers: input.headers,
        body: input.body,
        credentials: input.credentials,
        mode: input.mode,
        redirect: input.redirect,
        referrer: input.referrer,
        integrity: input.integrity,
      }
    }
  }

  const sep = url.includes('?') ? '&' : '?'
  const bustedUrl = `${url}${sep}_t=${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const mergedHeaders = new Headers(baseInit?.headers)
  mergedHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  mergedHeaders.set('Pragma', 'no-cache')

  return fetch(bustedUrl, {
    ...baseInit,
    cache: 'no-store',
    headers: mergedHeaders,
  })
}

export const supabase = createClient(validUrl, validKey, {
  global: { fetch: noCacheFetch },
})
