/* BusETA HK service worker
 * Strategy: pre-cache the app shell on install; cache-first with
 * network fallback for same-origin GETs; network-only for cross-origin
 * upstream API calls. Static JSON in /assets/ is cached lazily on first
 * fetch via the same code path.
 *
 * CACHE bumped to v11: Batch 1 of the feature push.
 *   - Service-disruption banner on the home view (curated
 *     `assets/disruptions.json`; no public upstream feed exists).
 *   - Share button + inline QR on stop and route views (vendored
 *     `qrcode-generator@1.4.4`, MIT, lazy-loaded as `assets/qrcode.js`).
 *   - Trip planner "depart by HH:MM" mode — works backward from a
 *     target arrival time instead of departing from now.
 * v10 was the recent-stops self-heal fix (KMB operator-ID reverse map).
 * The v11 bump forces cached clients to refetch the app shell and pick
 * up the three new features.
 */
const CACHE = 'buseta-v11';
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