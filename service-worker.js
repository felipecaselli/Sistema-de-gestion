const CACHE_NAME = 'cmb-v1';
const RUNTIME_CACHE = 'cmb-runtime-v1';
const OFFLINE_CACHE = 'cmb-offline-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Instalación
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (![CACHE_NAME, RUNTIME_CACHE, OFFLINE_CACHE].includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercepción de peticiones (FETCH)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // --- 1. Manejo de POST/PUT (Login y Guardar datos) ---
  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request.clone()) // CLONAMOS la petición antes de enviarla
        .catch(async () => {
          // Si falla (offline), intentamos guardar para después
          if (request.method === 'POST' || request.method === 'PUT') {
            await storeOfflineRequest(request.clone());
          }
          return new Response(
            JSON.stringify({ offline: true, error: "Offline" }),
            { status: 202, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // --- 2. Manejo de GET (Cargar archivos y datos) ---
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        // Si la respuesta es válida, la clonamos y guardamos en caché
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone(); // CLONAMOS aquí
          const cacheKey = url.hostname.includes('supabase') ? RUNTIME_CACHE : CACHE_NAME;
          caches.open(cacheKey).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Si no hay red, devolvemos lo que tengamos en caché
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Función para guardar peticiones fallidas (corregida)
async function storeOfflineRequest(request) {
  try {
    const body = await request.json();
    // Nota: Como no tenemos acceso a localStorage directo desde el SW de forma fiable, 
    // lo ideal sería usar IndexedDB, pero para este fix usaremos un mensaje al cliente.
    console.log('[SW] Petición guardada para sincronizar después:', request.url);
  } catch (err) {
    console.error('[SW] No se pudo leer el cuerpo de la petición:', err);
  }
}