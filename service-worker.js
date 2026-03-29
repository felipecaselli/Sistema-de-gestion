// Service Worker para PWA + Sincronización Offline
// CMB - Gestión de Órdenes

const CACHE_NAME = 'cmb-v1';
const RUNTIME_CACHE = 'cmb-runtime-v1';
const OFFLINE_CACHE = 'cmb-offline-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Algunos assets pueden ser remotos, no fallar si no se pueden cachear
        console.log('[SW] Some remote assets could not be cached during install');
      });
    })
  );
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE && cacheName !== OFFLINE_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first para API calls (Supabase), fallback a cache o respuesta offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // No cachear requests POST, PUT, DELETE sin embargo intentar sincronizar
  if (request.method !== 'GET') {
    // Detectar si es una request al API que requiere sincronización offline
    if (url.includes('supabase.co') || url.includes('/api/')) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            // Si está online, procesar normalmente
            return response;
          })
          .catch(() => {
            // Si está offline, almacenar request para sincronización posterior
            if (request.method === 'POST' || request.method === 'PUT') {
              storeOfflineRequest(request);
            }
            return new Response(
              JSON.stringify({ offline: true, queued: true }),
              { status: 202, statusText: 'Accepted (queued for sync)' }
            );
          })
      );
      return;
    }
  }

  // Para GET requests: Network first con fallback a cache
  if (request.method === 'GET') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const cache = url.includes('supabase.co') ? RUNTIME_CACHE : CACHE_NAME;
            caches.open(cache).then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Offline: buscar en cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Si no hay cache, devolver página offline
            return caches.match('/offline.html').catch(() => {
              return new Response('Offline - Sin caché disponible', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
          });
        })
    );
    return;
  }
});

// Almacenar requests offline para sincronizar después
function storeOfflineRequest(request) {
  return request.json().then((body) => {
    // Abrir IndexedDB o localStorage para almacenar
    const offlineRequests = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    offlineRequests.push({
      url: request.url,
      method: request.method,
      body: body,
      timestamp: Date.now()
    });
    localStorage.setItem('offlineQueue', JSON.stringify(offlineRequests));
    console.log('[SW] Request stored for offline sync:', request.url);
  }).catch(() => {
    console.log('[SW] Could not parse request body');
  });
}

// Sincronización en background (cuando se recupera conexión)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-requests') {
    event.waitUntil(syncOfflineRequests());
  }
});

async function syncOfflineRequests() {
  console.log('[SW] Starting offline sync...');
  const offlineRequests = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
  
  let successCount = 0;
  let failureCount = 0;

  for (const req of offlineRequests) {
    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });

      if (response.ok) {
        successCount++;
      } else {
        failureCount++;
      }
    } catch (error) {
      failureCount++;
      console.error('[SW] Sync failed for request:', req.url, error);
    }
  }

  // Limpiar requests sincronizados exitosamente
  if (successCount > 0) {
    localStorage.setItem('offlineQueue', JSON.stringify(offlineRequests.slice(successCount)));
    console.log(`[SW] Synced ${successCount} offline requests`);
  }

  // Notificar al cliente
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        success: successCount,
        failed: failureCount
      });
    });
  });
}

// Mensaje desde client para forzar sync
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_OFFLINE_REQUESTS') {
    syncOfflineRequests();
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
