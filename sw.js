// Offline-first app shell: stale-while-revalidate for same-origin GETs.
// dist chunk names are content-hashed, so runtime caching beats a precache list.
const CACHE = 'wavearea-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))

self.addEventListener('fetch', e => {
  let { request } = e
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      let hit = await cache.match(request)
      let net = fetch(request)
        .then(res => { if (res.ok) cache.put(request, res.clone()); return res })
        .catch(() => hit)
      return hit || net
    })
  )
})
