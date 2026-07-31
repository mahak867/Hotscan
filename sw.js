// HotScan India — Service Worker v5.0
// Provides offline support (cache-first for static assets) and deal-alert notifications.

const CACHE = 'hotscan-v9'
// index.html is deliberately NOT precached — see the fetch handler. It is the
// only file that names the current hashed asset bundles, so serving a stale copy
// points the browser at JS filenames that no longer exist on the server, which
// surfaces to the user as "Failed to fetch" on the next action they take.
const PRECACHE = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png',
  '/favicon.png',
]

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(PRECACHE)
    }).catch(function () { /* non-fatal if assets are missing */ })
  )
  self.skipWaiting()
})

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE }).map(function (k) {
          return caches.delete(k)
        })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', function (e) {
  var url = e.request.url
  // Never cache API calls, Supabase, Groq, analytics, or POST requests.
  // Use proper hostname checks (not bare substring) to prevent bypass via crafted URLs.
  if (e.request.method !== 'GET') return
  try {
    var host = new URL(url).hostname
    if (
      url.includes('/api/') ||
      host === 'supabase.co' || host.endsWith('.supabase.co') ||
      host === 'api.groq.com' || host.endsWith('.groq.com') ||
      host === 'checkout.razorpay.com' || host.endsWith('.razorpay.com') ||
      host === 'plausible.io' || host.endsWith('.plausible.io')
    ) return
  } catch (ex) { return }

  // The app shell must be NETWORK-FIRST.
  //
  // It was cache-first, with '/' and '/index.html' precached under a cache name
  // that is only bumped by hand. So once a browser cached the shell it kept that
  // copy indefinitely — and that copy names the hashed JS bundles of the build it
  // came from. After a few deploys those filenames are gone from the server, the
  // request for them fails, and the user sees "Failed to fetch" with no way out
  // short of clearing site data. It also meant no fix could ever reach an
  // existing user, which for a live product is worse than the stale asset.
  //
  // Hashed assets stay cache-first below: their filenames change per build, so a
  // cached one is never wrong.
  var isShell = e.request.mode === 'navigate' ||
                url.endsWith('/') ||
                url.indexOf('/index.html') > -1

  if (isShell) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var clone = res.clone()
          caches.open(CACHE).then(function (c) { c.put(e.request, clone) })
        }
        return res
      }).catch(function () {
        // Offline: a stale shell beats no app at all.
        return caches.match(e.request).then(function (c) {
          return c || caches.match('/index.html')
        })
      })
    )
    return
  }

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var networkFetch = fetch(e.request).then(function (res) {
        if (res.ok && res.type === 'basic') {
          var clone = res.clone()
          caches.open(CACHE).then(function (c) { c.put(e.request, clone) })
        }
        return res
      }).catch(function () {
        return cached || caches.match('/index.html')
      })
      return cached || networkFetch
    })
  )
})

// Push notification handler (for future server-side push via VAPID)
self.addEventListener('push', function (e) {
  if (!e.data) return
  var d
  try { d = e.data.json() } catch (ex) { return }
  e.waitUntil(
    self.registration.showNotification(d.title || 'HotScan Deal Alert 🔥', {
      body: d.body || 'A car on your watchlist has a price drop!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'hotscan-deal',
      renotify: true,
      data: { url: d.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', function (e) {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.includes('hotscan') && 'focus' in list[i]) {
          return list[i].focus()
        }
      }
      return clients.openWindow(e.notification.data.url || '/')
    })
  )
})
