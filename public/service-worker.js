// Service Worker für SPA-Routing Fallback
// Fehlerhafte Responses werden nicht gecacht
// v2: Cross-Origin-Requests (Supabase, Twitch, ...) NIE cachen
//     → alte v1-Caches mit gestauten API-Antworten werden beim Activate geloescht.
const CACHE_NAME = 'v2-spa-cache'
const NO_CACHE_URLS = ['/404.html', '/?', '/']

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installation')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Aktivierung')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Alte Cache gelöscht:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const { method, url } = request

  // Nur GET-Anfragen verarbeiten
  if (method !== 'GET') {
    return
  }

  // Cross-Origin-Requests (Supabase REST/Realtime, Twitch-API, GitHub, ...)
  // NIEMALS cachen oder umleiten — sonst sehen Mods DB-Aenderungen erst nach
  // "Cookies & Websitedaten loeschen" durch. Direkt ans Netzwerk weiterreichen
  // = SW grætscht nicht ein.
  let requestOrigin
  try { requestOrigin = new URL(url).origin } catch { requestOrigin = null }
  if (requestOrigin && requestOrigin !== self.location.origin) {
    return
  }

  // Navigations-Anfragen (HTML-Dokumente) - zuerst vom Netzwerk laden
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Nur erfolgreiche Responses cachen (2xx, 3xx)
          if (response.ok || response.status >= 300 && response.status < 400) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
            return response
          }
          // 404 oder andere Fehler nicht cachen - Fallback zu index.html
          return caches.match('/index.html').then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }
            // Fallback falls Cache leer
            return fetch('/')
              .then((response) => {
                if (response && response.status === 200) {
                  return response
                }
                throw new Error('Fallback konnte nicht geladen werden')
              })
              .catch(() => {
                return new Response(
                  'Service Unavailable\n\n' +
                  'Die Webseite könnte offline sein. Bitte versuchen Sie es später erneut.',
                  {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: new Headers({
                      'Content-Type': 'text/plain',
                      'Cache-Control': 'no-store, no-cache, must-revalidate',
                    }),
                  }
                )
              })
          })
        })
        .catch(() => {
          // Netzwerkfehler - Aus Cache oder Fallback
          return caches.match('/index.html').then((cachedResponse) => {
            return (
              cachedResponse ||
              new Response(
                'Service Unavailable\n\n' +
                'Die Webseite könnte offline sein. Bitte versuchen Sie es später erneut.',
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({
                    'Content-Type': 'text/plain',
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                  }),
                }
              )
            )
          })
        })
    )
    return
  }

  // Sub-Resource-Anfragen (CSS, JS, Bilder...) - Cache-First Strategie
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response
      }

      return fetch(request).then((response) => {
        // Nur erfolgreiche (2xx) Responses cachen
        if (response && response.status === 200) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache)
          })
          return response
        }
        return response
      })
    })
  )
})


