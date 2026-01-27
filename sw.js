/**
 * Homelab Hub - Service Worker
 * Strategy: Network-First for Data/Logic, Cache-First for Assets
 */

const CACHE_NAME = 'homelab-v3'; // Incrementing to v3 to clear old structures
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json'
];

// Resources that change frequently and should be fetched from network first
const DYNAMIC_RESOURCES = [
  'services.json',
  'script.js'
];

self.addEventListener('install', (event) => {
  // Take control immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  // Clean up old caches from previous versions
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // LOGIC: Network-First for services.json and script.js
  // This ensures your dashboard updates immediately when you push changes to GitHub.
  const isDynamic = DYNAMIC_RESOURCES.some(resource => url.pathname.includes(resource));

  if (isDynamic) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If successful, update the cache with the fresh version
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          // If network fails (offline), fall back to the cached version
          return caches.match(event.request);
        })
    );
    return;
  }

  // LOGIC: Cache-First for everything else (CSS, HTML, Icons)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
