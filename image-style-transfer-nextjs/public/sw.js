const CACHE_NAME = 'style-transfer-v2.0.0';
const MODEL_CACHE_NAME = 'onnx-models-v1.0.0';
const STATIC_CACHE_NAME = 'static-assets-v1.0.0';

// Core application files
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/_next/static/css/app/layout.css',
  '/_next/static/chunks/webpack.js',
  '/_next/static/chunks/main-app.js',
  '/_next/static/chunks/app/page.js',
  '/favicon.ico',
];

// WebAssembly files
const WASM_ASSETS = [
  '/wasm/style_transfer_wasm.js',
  '/wasm/style_transfer_wasm_bg.wasm',
  '/wasm/style_transfer_wasm.d.ts',
];

// ONNX model files (lazy-loaded)
const MODEL_FILES = [
  '/models/van_gogh_starry_night.onnx',
  '/models/picasso_cubist.onnx',
  '/models/cyberpunk_neon.onnx',
  '/models/monet_water_lilies.onnx',
  '/models/anime_studio_ghibli.onnx',
];

self.addEventListener('install', event => {
  console.log('[SW] Installing service worker');
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Cache WebAssembly files
      caches.open(CACHE_NAME).then(cache => {
        console.log('[SW] Caching WebAssembly assets');
        return cache.addAll(WASM_ASSETS);
      })
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== MODEL_CACHE_NAME && 
                cacheName !== STATIC_CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle ONNX model requests with lazy loading
  if (url.pathname.startsWith('/models/') && url.pathname.endsWith('.onnx')) {
    event.respondWith(handleModelRequest(event.request));
    return;
  }
  
  // Handle WebAssembly files
  if (url.pathname.startsWith('/wasm/')) {
    event.respondWith(handleWasmRequest(event.request));
    return;
  }
  
  // Handle static assets
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/_next/')) {
    event.respondWith(handleStaticRequest(event.request));
    return;
  }
  
  // Default network-first strategy
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Specialized handler for ONNX model files
async function handleModelRequest(request) {
  const cache = await caches.open(MODEL_CACHE_NAME);
  
  // Check if model is already cached
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('[SW] Serving cached model:', request.url);
    return cachedResponse;
  }
  
  try {
    console.log('[SW] Downloading model:', request.url);
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache the model for offline use
      cache.put(request, response.clone());
      console.log('[SW] Model cached successfully:', request.url);
      return response;
    }
    
    throw new Error(`Failed to fetch model: ${response.status}`);
  } catch (error) {
    console.error('[SW] Model fetch failed:', error);
    throw error;
  }
}

// Handler for WebAssembly files
async function handleWasmRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  // Cache-first strategy for WASM files
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('[SW] Serving cached WASM:', request.url);
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] WASM fetch failed:', error);
    throw error;
  }
}

// Handler for static assets
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  
  // Cache-first for static assets
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Fallback to cache if network fails
    return caches.match(request);
  }
}

// Message handling for cache management
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_MODEL') {
    const modelUrl = event.data.url;
    event.waitUntil(
      caches.open(MODEL_CACHE_NAME).then(cache => {
        return cache.add(modelUrl);
      })
    );
  }
  
  if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    event.waitUntil(
      Promise.all([
        caches.open(CACHE_NAME),
        caches.open(MODEL_CACHE_NAME),
        caches.open(STATIC_CACHE_NAME)
      ]).then(([mainCache, modelCache, staticCache]) => {
        return Promise.all([
          mainCache.keys(),
          modelCache.keys(),
          staticCache.keys()
        ]);
      }).then(([mainKeys, modelKeys, staticKeys]) => {
        event.ports[0].postMessage({
          type: 'CACHE_STATUS',
          data: {
            wasm_files: mainKeys.length,
            models_cached: modelKeys.length,
            static_files: staticKeys.length,
            total_cached: mainKeys.length + modelKeys.length + staticKeys.length
          }
        });
      })
    );
  }
});

// Background sync for model preloading
self.addEventListener('sync', event => {
  if (event.tag === 'preload-models') {
    event.waitUntil(preloadAllModels());
  }
});

async function preloadAllModels() {
  console.log('[SW] Preloading all models in background');
  const cache = await caches.open(MODEL_CACHE_NAME);
  
  const preloadPromises = MODEL_FILES.map(async (modelUrl) => {
    try {
      const response = await fetch(modelUrl);
      if (response.ok) {
        await cache.put(modelUrl, response);
        console.log('[SW] Preloaded model:', modelUrl);
      }
    } catch (error) {
      console.warn('[SW] Failed to preload model:', modelUrl, error);
    }
  });
  
  await Promise.allSettled(preloadPromises);
  console.log('[SW] Model preloading completed');
}