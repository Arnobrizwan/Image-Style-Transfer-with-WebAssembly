const CACHE_NAME = 'neural-style-transfer-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// Files to cache for offline support
const STATIC_FILES = [
  '/',
  '/_next/static/css/app/layout.css',
  '/_next/static/chunks/main-app.js',
  '/_next/static/chunks/app-pages-internals.js',
  '/_next/static/chunks/app/page.js',
  '/_next/static/chunks/webpack.js',
  '/_next/static/chunks/polyfills.js',
  '/wasm/style_transfer_wasm.js',
  '/wasm/style_transfer_wasm_bg.wasm',
  '/models/registry.json',
  '/models/van_gogh_starry_night.onnx',
  '/models/picasso_cubist.onnx',
  '/models/cyberpunk_neon.onnx',
  '/models/monet_water_lilies.onnx',
  '/models/anime_studio_ghibli.onnx'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static files...');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] Static files cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle different types of requests
  if (url.pathname.startsWith('/_next/') || 
      url.pathname.startsWith('/wasm/') || 
      url.pathname.startsWith('/models/')) {
    // Cache-first strategy for static assets
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            console.log('[SW] Serving from cache:', url.pathname);
            return response;
          }
          
          // Fetch from network and cache
          return fetch(request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                const responseClone = networkResponse.clone();
                caches.open(DYNAMIC_CACHE)
                  .then((cache) => {
                    cache.put(request, responseClone);
                  });
              }
              return networkResponse;
            })
            .catch(() => {
              // Return cached version if network fails
              return caches.match(request);
            });
        })
    );
  } else if (url.pathname === '/') {
    // Network-first strategy for main page
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(request, responseClone);
              });
          }
          return response;
        })
        .catch(() => {
          // Return cached version if network fails
          return caches.match(request);
        })
    );
  }
});

// Background sync for model preloading
self.addEventListener('sync', (event) => {
  if (event.tag === 'preload-models') {
    console.log('[SW] Preloading models in background...');
    event.waitUntil(preloadModels());
  }
});

// Preload all models for offline use
async function preloadModels() {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const modelUrls = [
      '/models/van_gogh_starry_night.onnx',
      '/models/picasso_cubist.onnx',
      '/models/cyberpunk_neon.onnx',
      '/models/monet_water_lilies.onnx',
      '/models/anime_studio_ghibli.onnx'
    ];

    for (const modelUrl of modelUrls) {
      try {
        const response = await fetch(modelUrl);
        if (response.ok) {
          await cache.put(modelUrl, response);
          console.log('[SW] Preloaded model:', modelUrl);
        }
      } catch (error) {
        console.warn('[SW] Failed to preload model:', modelUrl, error);
      }
    }
    
    console.log('[SW] Model preloading completed');
  } catch (error) {
    console.error('[SW] Model preloading failed:', error);
  }
}

// Handle push notifications (for future features)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  const options = {
    body: 'Neural Style Transfer is ready to use!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Neural Style Transfer', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Handle message events from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'PRELOAD_MODELS') {
    preloadModels();
  }
});