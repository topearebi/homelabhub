/**
 * Homelab Hub - Service Worker
 * Strategy: Network-First for Data/Logic, Cache-First for Assets
 */

const CACHE_NAME = 'homelab-v6'; // Incrementing cache version for updated stack
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icon.svg'
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
  const isDynamic = DYNAMIC_RESOURCES.some(resource => url.pathname.includes(resource));

  if (isDynamic) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
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
