/**
 * Hub service worker
 *  - App shell: cache-first, so the hub opens instantly and offline.
 *  - services.json: network-first, so link changes show up right away.
 *  - Anything on another origin (weather, favicons) is left to the browser.
 * Bump CACHE_VERSION whenever you change index.html, style.css or script.js.
 */
const CACHE_VERSION = 'v3.3.0';
const STATIC_CACHE = `hub-static-${CACHE_VERSION}`;
const DATA_CACHE = `hub-data-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './style.css?v=3.2.0',
  './script.js',
  './script.js?v=3.2.0',
  './manifest.json',
  './icon.svg',
  './alticon.svg',
  './hsk1/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('services.json')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(DATA_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
