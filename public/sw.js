const CACHE_NAME = 'foodex-v18';
const STATIC_ASSETS = [
  './',
  './index.html',
  './foodkeeper.json',
  './manifest.json',
  './logo.png'
];

// ── Install: pre-cache shell ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// ── Activate: purge old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// ── Fetch: Network-first for API, Cache-first for static assets ───────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Never cache: Firebase, external APIs, Gemini, Wikipedia images
  const bypassDomains = [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'generativelanguage.googleapis.com',
    'openfoodfacts.org',
    'wikipedia.org',
    'wikimedia.org'
  ];
  if (bypassDomains.some(d => url.includes(d))) return;

  // JS/CSS/HTML assets from same origin → Stale-While-Revalidate (fast + fresh)
  if (url.startsWith(self.location.origin) || url.includes('georgemoraru.github.io/FoodEx')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((networkRes) => {
          if (networkRes.ok) cache.put(event.request, networkRes.clone());
          return networkRes;
        }).catch(() => cached); // fall back to cache on network failure

        // Return cached immediately, update in background
        return cached || fetchPromise;
      }).catch(() => {
        // Offline fallback: return cached index.html for SPA navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
    );
    return;
  }

  // All other requests: network-only
});

// ── Push Notifications ────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'FoodEx Alert', body: 'Check your food inventory!' };

  if (event.data) {
    try { data = event.data.json(); }
    catch (e) { data = { title: 'FoodEx Alert', body: event.data.text() }; }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './logo.png',
      badge: './logo.png',
      tag: 'foodex-alert',
      renotify: true,
      data: { url: data.data?.url || './' }
    })
  );
});

// ── Notification Click ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ('focus' in win) { win.focus(); return; }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
