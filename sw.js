/* BusETA HK service worker
 * Strategy: pre-cache the app shell on install; cache-first with
 * network fallback for same-origin GETs; network-only for cross-origin
 * upstream API calls. Static JSON in /assets/ is cached lazily on first
 * fetch via the same code path.
 *
 * CACHE bumped to v10: v9 added the justarrived-style stop row + the
 * `enrichRecentStop` cache for resolved stop names. v10 self-heals a
 * hole in that work — direct navigation to `#/stop/<operator-id>` (e.g.
 * `#/stop/ST905`) reaches the bus-stop view with an ID the KMB upstream
 * `/stop/{id}` can't resolve (KMB uses internal 16-hex IDs; the
 * operator-facing code is only exposed as a `(ST905)` suffix on each
 * stop's name_tc). The new `state.index.kmbOperatorId` reverse map is
 * built from those suffixes at index time, so the bus-stop view can
 * resolve `ST905 → 大學站` without a network round-trip, and `renderHome`
 * now self-heals any recent entries previously poisoned with the raw
 * operator ID as the cached name. v10 also strips that suffix when
 * caching so the recent row title reads cleanly.
 */
const CACHE = 'buseta-v10';
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