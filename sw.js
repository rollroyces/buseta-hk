/* BusETA HK service worker
 * Strategy: pre-cache the app shell on install; cache-first with
 * network fallback for same-origin GETs; network-only for cross-origin
 * upstream API calls. Static JSON in /assets/ is cached lazily on first
 * fetch via the same code path.
 *
 * CACHE bumped to v12: Batch 2 of the feature push.
 *   - Light theme + system-preference-aware toggle (dark → light →
 *     system → dark cycle; first paint remains dark for first-time
 *     visitors). Inline theme loader in `<head>` so first paint never
 *     flashes the wrong palette.
 *   - First-run empty-state hero on the home view (3 CTA pills:
 *     search / location / hot routes), pure-CSS bus illustration,
 *     shows only when saved routes / saved stops / recent are all
 *     empty.
 *   - In-place O↔I bound swap control on the route detail view, with
 *     optional swipe gesture (left = O → I, right = I → O). One-way
 *     routes get the button hidden.
 * v11 was Batch 1 (service-alerts banner + share/QR + planner
 * depart-by mode). The v12 bump forces cached clients to refetch the
 * app shell and pick up the three new features.
 *
 * Offline mode (Batch 3, layered on top of v12 — SW version itself is
 * still v12, so the cache-buster bump stays the parent's job):
 *   - ASSET_CACHE: same-origin /assets/*.json — cache-first with
 *     background revalidation, so static JSON (routes / stops / MTR /
 *     LRT / curated disruption snapshot) is available offline after
 *     the first online load.
 *   - ETA_CACHE: cross-origin ETA responses (KMB / LWB / CTB / GMB /
 *     MTR / MTR-static) — stale-while-revalidate with a 5-minute
 *     freshness window. Cache hits within the window return
 *     immediately and refresh in the background; stale cache hits
 *     fall back to the cached copy only if the network request fails.
 *   - Navigation requests for `/` (and any SPA-style navigate) serve
 *     the pre-cached `/index.html` when the network is unreachable,
 *     so the app shell boots cold-offline.
 *   - `activate` only drops legacy `buseta-vN` caches with N < 12;
 *     the new ASSET_CACHE / ETA_CACHE are kept alongside the SHELL
 *     cache so future deploys don't wipe offline data.
 * NEXT DEPLOY MUST bump `CACHE` to v13 so cached clients re-fetch the
 * shell + new fetch handlers. (Parent's cache-buster bump will pick
 * that up.)
 */
const CACHE = 'buseta-v12';
const SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json'
];

// Runtime caches — separate buckets so we can evolve each strategy
// without trashing the others. Names are versioned (`: v1`) so a
// future shape change can ship as `:v2` while old entries age out
// via the activate-handler cleanup below.
const ASSET_CACHE = 'buseta-assets-v1';
const ETA_CACHE = 'buseta-eta-v1';

// 5-minute freshness window for cached ETA responses. The operator
// feeds update roughly every minute, so 5 min balances "don't
// spam upstream on every render" against "don't show stale ETAs for
// too long after coming back online".
const ETA_MAX_AGE_MS = 5 * 60 * 1000;

// Upstream API origins whose responses are safe to cache briefly for
// offline fallback. Anything else cross-origin stays network-only.
const ETA_ORIGINS = new Set([
  'https://data.etabus.gov.hk',  // KMB / LWB
  'https://rt.data.gov.hk',      // CTB / NWFB / MTR heavy rail / MTR LRT
  'https://data.etagmb.gov.hk',  // GMB (Green Minibus)
  'https://opendata.mtr.com.hk', // MTR static line / station list
]);

function isAssetJsonPath(pathname) {
  return pathname.startsWith('/assets/') && pathname.endsWith('.json');
}

function isEtaOrigin(origin) {
  return ETA_ORIGINS.has(origin);
}

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
        // Drop legacy `buseta-vN` for N < 12; keep v12 + runtime
        // caches so existing offline data survives the bump.
        keys.filter((k) => {
          const m = /^buseta-v(\d+)$/.exec(k);
          if (m) return parseInt(m[1], 10) < 12;
          return k !== CACHE && k !== ASSET_CACHE && k !== ETA_CACHE;
        }).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Wrap a Response with a cache-timestamp header so SWR consumers can
// tell when the entry was last refreshed. The body is read into an
// ArrayBuffer first so the original response's body stream is left
// untouched for the caller.
async function timestampedResponse(resp) {
  const body = await resp.arrayBuffer();
  const headers = new Headers(resp.headers);
  headers.set('x-sw-cached-at', String(Date.now()));
  return new Response(body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}

// Stale-while-revalidate with a freshness window. Returns the cached
// copy if it's still fresh, otherwise tries the network and falls
// back to the stale cache only if the network is unreachable.
async function etaSWR(req, cache) {
  const cached = await cache.match(req);
  const cachedAt = cached
    ? parseInt(cached.headers.get('x-sw-cached-at') || '0', 10) || 0
    : 0;
  const fresh = cached && cachedAt && (Date.now() - cachedAt) < ETA_MAX_AGE_MS;

  // Always attempt a network refresh — when the cache is fresh the
  // response is dropped on the floor, when stale it becomes the new
  // cache entry.
  const networkFetch = fetch(req).then(async (resp) => {
    if (resp && resp.ok) {
      try {
        const wrapped = await timestampedResponse(resp);
        await cache.put(req, wrapped);
      } catch (_) { /* body read failed; skip cache write */ }
    }
    return resp;
  }).catch(() => null);

  if (fresh) {
    // Background revalidate; do not block the response on it.
    return cached;
  }

  const live = await networkFetch;
  if (live) return live;
  if (cached) return cached;        // stale-but-better-than-nothing
  return new Response('', { status: 504, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GETs.
  if (req.method !== 'GET') return;

  const reqUrl = new URL(req.url);

  // 1) Same-origin /assets/*.json — cache-first with background
  //    revalidation. The SHELL cache covers the app's own code/CSS/
  //    HTML; ASSET_CACHE covers the static data files (stop lists,
  //    route shapes, disruption snapshots).
  if (reqUrl.origin === self.location.origin && isAssetJsonPath(reqUrl.pathname)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) {
            // Background refresh so the cache stays current.
            event.waitUntil(
              fetch(req).then((resp) => {
                if (resp && resp.ok) cache.put(req, resp.clone());
              }).catch(() => null)
            );
            return cached;
          }
          return fetch(req).then((resp) => {
            if (resp && resp.ok) cache.put(req, resp.clone());
            return resp;
          }).catch(() => new Response('', { status: 504, statusText: 'Offline' }));
        })
      )
    );
    return;
  }

  // 2) Cross-origin ETA APIs — stale-while-revalidate, 5-min window.
  if (isEtaOrigin(reqUrl.origin)) {
    event.respondWith(
      caches.open(ETA_CACHE).then((cache) => etaSWR(req, cache))
    );
    return;
  }

  // 3) Navigation requests — try the network, fall back to the
  //    pre-cached app shell. This is what lets the user land on `/`
  //    while the device has no connectivity at all.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
        .then((resp) => resp || caches.match('/index.html'))
    );
    return;
  }

  // 4) Other same-origin — cache-first with network fallback, then
  //    cache the fresh response (covers the SHELL entries themselves
  //    if the pre-cache step missed one for any reason).
  if (reqUrl.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(req).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(req, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 504, statusText: 'Offline' }));
      })
    );
    return;
  }

  // 5) Other cross-origin — network only, never cache.
});
