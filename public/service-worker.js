// Service Worker für SPA-Routing fallback
// Cache nicht-erfolgreiche Responses nicht
const CACHE_NAME = 'v1-spa-cache'
const NO_CACHE_URLS = ['/404.html', '/?', '/']

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install event')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate event')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName)
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

  // Nur GET-Requests handhaben
  if (method !== 'GET') {
    return
  }

  // Navigation Requests (document) - immer von Netzwerk laden
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
          // 404 oder andere Fehler nicht cachen - zurück zu index.html
          return caches.match('/index.html').then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }
            // Fallback wenn cache leer
            return fetch('/')
              .then((response) => {
                if (response && response.status === 200) {
                  return response
                }
                throw new Error('Failed to fetch fallback')
              })
              .catch(() => {
                return new Response(
                  'Service Unavailable\n\n' +
                  'The webpage might be offline. Please try again later.',
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
          // Netzwerkfehler - aus Cache oder Fallback
          return caches.match('/index.html').then((cachedResponse) => {
            return (
              cachedResponse ||
              new Response(
                'Service Unavailable\n\n' +
                'The webpage might be offline. Please try again later.',
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

  // Sub-Resource Requests (CSS, JS, Images...) - Cache-First
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response
      }

      return fetch(request).then((response) => {
        // Nur 2xx Responses cachen
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

