// HotScan India — Service Worker v5.0
// Provides offline support (cache-first for static assets) and deal-alert notifications.

const CACHE = 'hotscan-v5'
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
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
  // Never cache API calls, Supabase, Groq, analytics, or POST requests
  if (
    e.request.method !== 'GET' ||
    url.includes('/api/') ||
    url.includes('supabase.co') ||
    url.includes('groq.com') ||
    url.includes('razorpay') ||
    url.includes('plausible.io')
  ) {
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
