/* BusETA HK service worker
 * Strategy: pre-cache the app shell on install; cache-first with
 * network fallback for same-origin GETs; network-only for cross-origin
 * upstream API calls. Static JSON in /assets/ is cached lazily on first
 * fetch via the same code path.
 *
 * CACHE bumped to v9: v8 shipped the fare worker's per-stop fare pills
 * + the `車費 $X.X – $Y.Y` header range + the `—` chip on routes without
 * fare data, plus KMB / LWB hardcoded fallback JSON. v9 adds the
 * justarrived-style stop-row enhancement — operator stop code (e.g. ST905),
 * `起點` marker on the origin stop, and a stacked multi-arrival ETA
 * column (`X 分鐘 · HH:MM`) — across the KMB / CTB / NWFB / GMB / LRT
 * stop-row render blocks. Existing v8 clients get the working fare UI;
 * the v9 bump forces them to refetch and pick up the new stop-row layout.
 */
const CACHE = 'buseta-v9';
const SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GETs.
  if (req.method !== 'GET') return;

  const reqUrl = new URL(req.url);

  // Cross-origin (upstream APIs) → network only, never cache.
  if (reqUrl.origin !== self.location.origin) {
    return;
  }

  // Same-origin: cache-first, fall back to network, populate cache.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(req).then((response) => {
        // Cache successful basic/cors responses so static JSON in
        // /assets/ (and any other same-origin asset) is cached lazily.
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return response;
      }).catch(() => {
        // Offline and not cached — for navigations, serve the SPA shell.
        if (req.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});