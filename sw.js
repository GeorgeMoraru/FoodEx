const CACHE_NAME = 'foodex-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/foodkeeper.json',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Don't cache API requests or external image resources
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('wikipedia.org')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          // Cache successful responses for our domain
          if (networkResponse.ok && event.request.url.startsWith(self.location.origin)) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      });
    }).catch(() => {
      // Fallback for offline if not in cache (e.g., return cached index for SPA routing)
      if (event.request.mode === 'navigate') {
        return caches.match('/');
      }
    })
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'FoodEx Alert', body: 'Check your food inventory!' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'FoodEx Alert', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍎</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍎</text></svg>',
    data: {
      url: data.data?.url || '/#inventory'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If there's an open window, focus it and redirect
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          client.focus();
          if (client.url.includes(targetUrl) || client.url.includes(location.origin)) {
            return client.navigate(targetUrl);
          }
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
