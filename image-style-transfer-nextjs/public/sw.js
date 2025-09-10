// Service Worker for Neural Style Transfer App
// Provides offline support and caching for WASM, models, and assets

const CACHE_NAME = 'neural-style-transfer-v1.0.0';
const STATIC_CACHE = 'neural-style-static-v1.0.0';
const DYNAMIC_CACHE = 'neural-style-dynamic-v1.0.0';

// Essential assets to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/wasm/style_transfer_wasm.js',
  '/wasm/style_transfer_wasm_bg.wasm',
  '/models/registry.json',
  '/models/van_gogh_starry_night.onnx',
  '/models/picasso_cubist.onnx',
  '/models/cyberpunk_neon.onnx',
  '/models/monet_water_lilies.onnx',
  '/models/anime_studio_ghibli.onnx',
  '/_next/static/css/',
  '/_next/static/js/',
  '/favicon.ico'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
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

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          console.log('[SW] Serving from cache:', url.pathname);
          return cachedResponse;
        }
        
        // Otherwise, fetch from network
        return fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response for caching
            const responseToCache = response.clone();
            
            // Determine which cache to use based on request type
            let targetCache = DYNAMIC_CACHE;
            if (url.pathname.startsWith('/wasm/') || 
                url.pathname.startsWith('/models/') ||
                url.pathname.startsWith('/_next/static/')) {
              targetCache = STATIC_CACHE;
            }
            
            // Cache the response
            caches.open(targetCache)
              .then((cache) => {
                console.log('[SW] Caching response:', url.pathname);
                cache.put(request, responseToCache);
              })
              .catch((error) => {
                console.warn('[SW] Failed to cache response:', error);
              });
            
            return response;
          })
          .catch((error) => {
            console.log('[SW] Network request failed:', url.pathname, error);
            
            // Return offline fallback for specific requests
            if (url.pathname === '/' || url.pathname === '/index.html') {
              return caches.match('/index.html');
            }
            
            // Return a custom offline response for API requests
            if (url.pathname.startsWith('/api/')) {
              return new Response(
                JSON.stringify({ 
                  error: 'Offline', 
                  message: 'This feature requires an internet connection' 
                }),
                { 
                  status: 503, 
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            }
            
            // Return a generic offline response
            return new Response(
              'Offline - This content is not available without an internet connection',
              { 
                status: 503, 
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
              }
            );
          });
      })
  );
});

// Background sync for model downloads
self.addEventListener('sync', (event) => {
  if (event.tag === 'model-sync') {
    console.log('[SW] Background sync for model downloads');
    event.waitUntil(syncModels());
  }
});

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New update available!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/favicon.ico'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/favicon.ico'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Neural Style Transfer', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Helper function to sync models in background
async function syncModels() {
  try {
    console.log('[SW] Syncing models in background...');
    
    // Pre-cache all model files
    const modelUrls = [
      '/models/van_gogh_starry_night.onnx',
      '/models/picasso_cubist.onnx',
      '/models/cyberpunk_neon.onnx',
      '/models/monet_water_lilies.onnx',
      '/models/anime_studio_ghibli.onnx'
    ];
    
    const cache = await caches.open(STATIC_CACHE);
    
    for (const url of modelUrls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          console.log('[SW] Model cached:', url);
        }
      } catch (error) {
        console.warn('[SW] Failed to cache model:', url, error);
      }
    }
    
    console.log('[SW] Model sync completed');
  } catch (error) {
    console.error('[SW] Model sync failed:', error);
  }
}

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_MODELS') {
    event.waitUntil(syncModels());
  }
});

console.log('[SW] Service worker script loaded');