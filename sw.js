/**
 * HOMELAB SWITCHBOARD // SERVICE WORKER
 * Dual-Cache Strategy:
 *  - Core App Shell: Cache-First (statically precached, high-availability offline)
 *  - Services Manifest: Network-First (instant updates with cached fallback)
 */

const CACHE_VERSION = 'v2.0.2';
const STATIC_CACHE = `hub-static-${CACHE_VERSION}`;
const DATA_CACHE = `hub-data-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon.svg',
  './alticon.svg',
  './hsk1/index.html'
];

// --- Install Phase: Precache Static App Shell ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      // Force activation immediately without waiting for existing tabs to close
      return self.skipWaiting();
    })
  );
});

// --- Activation Phase: Clean Obsolete Caches & Claim Clients ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== DATA_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      // Take control of all open pages under scope immediately
      return self.clients.claim();
    })
  );
});

// --- Fetch Phase: Contextual Routing ---
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Bypass non-GET requests and external telemetry endpoints
  if (event.request.method !== 'GET') return;
  if (
    requestUrl.hostname.includes('ipify.org') ||
    requestUrl.hostname.includes('open-meteo.com') ||
    requestUrl.pathname.includes('/cdn-cgi/trace')
  ) {
    return;
  }

  // 1. Data Route (services.json): Network-First, Cache-Fallback
  if (requestUrl.pathname.endsWith('services.json')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(DATA_CACHE).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // 2. Static App Shell: Cache-First, Fallback to Network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache newly fetched same-origin static assets on the fly
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          event.request.url.startsWith(self.location.origin)
        ) {
          const clone = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      });
    })
  );
});
