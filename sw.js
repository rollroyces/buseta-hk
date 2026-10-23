/* BusETA HK service worker
 * Strategy: pre-cache the app shell on install; cache-first with
 * network fallback for same-origin GETs; network-only for cross-origin
 * upstream API calls. Static JSON in /assets/ is cached lazily on first
 * fetch via the same code path.
 *
 * v35 is the v64→v65 cache-buster bump (Phase 42 — Web Push: `push`
 * and `notificationclick` event handlers + parseVapidKey helper.
 * Subscription JSON lives in client-side localStorage; a future server
 * is needed to actually deliver pushes — see docs/push-notifications.md).
 *
 * v33 is the v60→v61 cache-buster bump (PWA install icons + favicon PNG
 * variants + iOS apple-touch-icon). The PNGs are committed to assets/
 * via scripts/build-icons.py so re-running keeps the SVG and PNG copies
 * in lock-step.
 *
 * v34 is the v61→v62 cache-buster bump (zh-Hans i18n parity — adds
 * 11 missing translations so the three STRINGS blocks have identical
 * key sets; backed by scripts/check-i18n.js + tests/unit/i18n-parity.test.js).
 *
 * v32 was the v54 cache-buster bump (planner walking-segments on the
 * route-shape canvas).
 *
 * v27 was the v39 cache-buster bump (disruption banner hide via
 * short-circuit). The dedicated /assets/disruptions.json SWR branch
 * below remains in place for the same one-line-revert reason noted
 * in app.js fetchDisruptions().
 *
 * v26 was the v38 cache-buster bump (disruption banner freshness: until
 * filter + 6h TTL on assets/disruptions.json). Hand-authored content
 * remains cacheable via the dedicated branch below for the same
 * restore-in-one-line reason noted in app.js fetchDisruptions().
 *
 * v25 was the v37 cache-buster bump (terminus scan).
 * v24 was the v36 cache-buster bump (operator-code → internal-ID).
 * v23 was v35's cache-buster bump (.route-card--no-eta placeholder).
 * v22 was the v33 cache-buster bump (settings view + hardenings).
 * v21 was the same forced-update after v32's QW-1 → QW-10 batch.
 * v20 was the same forced-update after the v30→v31 layout revert.
 */
// Phase 47 — the cache version lives in ONE place.
//
// The old code kept the version in two independent literals: the
// `const CACHE = 'buseta-vN'` name AND a hardcoded `parseInt(m[1], 10) < N`
// threshold in the activate handler's cleanup filter. Those drifted:
// the threshold was still 44 while CACHE was buseta-v64, and then again
// while CACHE was buseta-v66. Every drift leaks one stale cache bucket
// per release — each ~700 KB (the app shell + the 20 src/utils scripts
// that branch 4 caches into the version bucket), so a year of releases
// stranded ~15 MB of a user's origin quota.
//
// Worse, the offline navigate fallback used `caches.match('/index.html')`,
// which searches EVERY bucket in creation order — so an offline user
// could be served an ancient index.html from the oldest leaked bucket.
//
// Deriving both from CACHE_VERSION makes the drift impossible.
const CACHE_VERSION = 69;
const CACHE = `buseta-v${CACHE_VERSION}`;

// The app shell. `/app.js` and `/style.css` are stored WITHOUT their
// `?v=` query string (the version lives in the bucket name), and the
// same-origin fetch branch matches with `ignoreSearch: true`, so these
// entries are actually reachable — before Phase 47 they were written
// on install and then never served.
//
// The `src/utils/*.js` modules are included because they are the app
// shell too: without them an offline boot has no `busetaUtils.*` and
// every view that calls a helper breaks. `tests/unit/sw-shell.test.js`
// asserts this list stays in sync with index.html's script tags.
const SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json',
  '/src/utils/concurrency.js',
  '/src/utils/date.js',
  '/src/utils/debug-log.js',
  '/src/utils/disruption-classify.js',
  '/src/utils/disruptions.js',
  '/src/utils/focus-trap.js',
  '/src/utils/geo.js',
  '/src/utils/history.js',
  '/src/utils/keyboard-shortcuts.js',
  '/src/utils/network.js',
  '/src/utils/operators.js',
  '/src/utils/push-subscriptions.js',
  '/src/utils/route-stops.js',
  '/src/utils/routes-by-stop.js',
  '/src/utils/share-target.js',
  '/src/utils/stop-view-summary.js',
  '/src/utils/stops-cache.js',
  '/src/utils/text.js',
  '/src/utils/time.js',
  '/src/utils/trams.js',
];

// Runtime caches — separate buckets so we can evolve each strategy
// without trashing the others. Names are versioned (`: v1`) so a
// future shape change can ship as `:v2` while old entries age out
// via the activate-handler cleanup below.
const ASSET_CACHE = 'buseta-assets-v1';
const ETA_CACHE = 'buseta-eta-v2';
// (was 'buseta-eta-v1' before v15 — bumped to invalidate the empty-
// body poisoned entries left over from the v13 body-consumption bug.)
const TD_DISRUPTION_CACHE = 'buseta-td-disruptions-v1';

// 5-minute freshness window for cached ETA responses. The operator
// feeds update roughly every minute, so 5 min balances "don't
// spam upstream on every render" against "don't show stale ETAs for
// too long after coming back online".
const ETA_MAX_AGE_MS = 5 * 60 * 1000;

// 6-hour freshness window for the curated service-disruption snapshot.
// The JSON is hand-authored and shipped in the static bundle, so there's
// no upstream rate-limit concern; the only cost of a 6h window is one
// extra network round-trip per home-view mount. Without this, a
// returning user would see stale alerts until the next cache-buster
// bump forces a fresh fetch.
const DISRUPTION_MAX_AGE_MS = 6 * 60 * 60 * 1000;

// Transport Department disruption XML — daily-updated feed that the
// v37-era audit missed. ~3.5 MB body, daily Last-Modified, CORS *, so
// we cache it in its own bucket with a 24h TTL and pass If-Modified-
// Since on revalidation so the server only sends a fresh body when it
// actually changed. Falls through to the network when the SW is bypassed
// (e.g. first visit before the SW installs).
const TD_DISRUPTION_URL =
  'https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Public_Transports.xml';
const TD_DISRUPTION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Upstream API origins whose responses are safe to cache briefly for
// offline fallback. Anything else cross-origin stays network-only.
const ETA_ORIGINS = new Set([
  'https://data.etabus.gov.hk', // KMB / LWB
  'https://rt.data.gov.hk', // CTB / NWFB / MTR heavy rail / MTR LRT
  'https://data.etagmb.gov.hk', // GMB (Green Minibus)
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
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          // Drop every legacy `buseta-vN` whose version is below the
          // current CACHE_VERSION; keep the current bucket + ASSET_CACHE
          // + ETA_CACHE + TD_DISRUPTION_CACHE so existing offline data
          // survives. The threshold is DERIVED from CACHE_VERSION (not a
          // second hand-maintained literal) so it cannot drift.
          // Also explicitly drop the poisoned `buseta-eta-v1` cache
          // (bumped to v2) so users on the v13-era poisoned SWR cache
          // stop getting empty-body responses back.
          keys
            .filter((k) => {
              if (k === 'buseta-eta-v1') return true; // poisoned, drop
              const m = /^buseta-v(\d+)$/.exec(k);
              if (m) return parseInt(m[1], 10) < CACHE_VERSION;
              return (
                k !== CACHE && k !== ASSET_CACHE && k !== ETA_CACHE && k !== TD_DISRUPTION_CACHE
              );
            })
            .map((k) => caches.delete(k))
        )
      )
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
// `maxAgeMs` is the per-bucket freshness window (ETA_MAX_AGE_MS for
// upstream APIs, DISRUPTION_MAX_AGE_MS for the curated snapshot).
async function etaSWR(req, cache, maxAgeMs = ETA_MAX_AGE_MS) {
  const cached = await cache.match(req);
  const cachedAt = cached ? parseInt(cached.headers.get('x-sw-cached-at') || '0', 10) || 0 : 0;
  const fresh = cached && cachedAt && Date.now() - cachedAt < maxAgeMs;

  // Always attempt a network refresh — when the cache is fresh the
  // response is dropped on the floor, when stale it becomes the new
  // cache entry.
  const networkFetch = fetch(req)
    .then(async (resp) => {
      if (resp && resp.ok) {
        try {
          // Clone before reading: `timestampedResponse` consumes the
          // upstream body via arrayBuffer() so the original `resp`
          // handed back to the caller must be an untouched clone —
          // otherwise the app's `resp.json()` reads empty and reports
          // "搵唔到呢條路線 / route not found" for every fresh network
          // response the SW intercepts.
          const wrapped = await timestampedResponse(resp.clone());
          await cache.put(req, wrapped);
        } catch (_) {
          /* body read failed; skip cache write */
        }
      }
      return resp;
    })
    .catch(() => null);

  if (fresh) {
    // Background revalidate; do not block the response on it.
    return cached;
  }

  const live = await networkFetch;
  if (live) return live;
  if (cached) return cached; // stale-but-better-than-nothing
  return new Response('', { status: 504, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GETs.
  if (req.method !== 'GET') return;

  const reqUrl = new URL(req.url);

  // 0) Transport Department disruption XML — dedicated bucket with a
  //    24h TTL + If-Modified-Since. The feed is daily-updated, the body
  //    is ~3.5 MB, and the SW otherwise treats cross-origin requests
  //    as network-only — so without this branch every home-view mount
  //    re-downloads the whole file. We do the freshness check on the
  //    x-sw-cached-at header (set by timestampedResponse); cached
  //    entries from before v40's wire-up lack that header so the first
  //    request after upgrade falls through to the network and rewrites
  //    the entry. On 200 we re-cache + return the wrapped response; on
  //    304 we return the still-fresh cached body.
  if (reqUrl.href === TD_DISRUPTION_URL) {
    event.respondWith(
      caches.open(TD_DISRUPTION_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const cachedAt = cached
          ? parseInt(cached.headers.get('x-sw-cached-at') || '0', 10) || 0
          : 0;
        const fresh = cached && cachedAt && Date.now() - cachedAt < TD_DISRUPTION_MAX_AGE_MS;
        const cachedLastMod = cached ? cached.headers.get('last-modified') || '' : '';

        if (fresh) {
          // Background revalidate with IMS so the server only sends a
          // fresh body when the feed actually changed since the cached
          // Last-Modified. Drop the 200 result on the floor if the
          // cache is still fresh — nothing to do.
          const headers = cachedLastMod ? { 'If-Modified-Since': cachedLastMod } : {};
          event.waitUntil(
            fetch(new Request(req, { headers }))
              .then(async (resp) => {
                if (resp && resp.ok) {
                  try {
                    const wrapped = await timestampedResponse(resp.clone());
                    await cache.put(req, wrapped);
                  } catch (_) {
                    /* body read failed; skip cache write */
                  }
                }
              })
              .catch(() => null)
          );
          return cached;
        }

        // Stale or missing — try the network with IMS if we have it.
        const headers = cachedLastMod ? { 'If-Modified-Since': cachedLastMod } : {};
        const live = await fetch(new Request(req, { headers })).catch(() => null);
        if (live && live.ok) {
          try {
            const wrapped = await timestampedResponse(live.clone());
            await cache.put(req, wrapped);
          } catch (_) {
            /* body read failed; return live anyway */
          }
          return live;
        }
        if (live && live.status === 304 && cached) return cached;
        if (cached) return cached; // stale-but-better-than-nothing
        return new Response('', { status: 504, statusText: 'Offline' });
      })
    );
    return;
  }

  // 1a) Same-origin /assets/disruptions.json — SWR with a 6h freshness
  //    window. Hand-authored snapshot that can change any time the
  //    operator news changes; without a TTL, returning users would see
  //    a stale copy until the next cache-buster bump. Other assets stay
  //    on the plain cache-first path below.
  if (reqUrl.origin === self.location.origin && reqUrl.pathname === '/assets/disruptions.json') {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) => etaSWR(req, cache, DISRUPTION_MAX_AGE_MS))
    );
    return;
  }

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
              fetch(req)
                .then((resp) => {
                  if (resp && resp.ok) cache.put(req, resp.clone());
                })
                .catch(() => null)
            );
            return cached;
          }
          return fetch(req)
            .then((resp) => {
              if (resp && resp.ok) cache.put(req, resp.clone());
              return resp;
            })
            .catch(() => new Response('', { status: 504, statusText: 'Offline' }));
        })
      )
    );
    return;
  }

  // 2) Cross-origin ETA APIs — stale-while-revalidate, 5-min window.
  if (isEtaOrigin(reqUrl.origin)) {
    event.respondWith(caches.open(ETA_CACHE).then((cache) => etaSWR(req, cache)));
    return;
  }

  // 3) Navigation requests — try the network, fall back to the
  //    pre-cached app shell. This is what lets the user land on `/`
  //    while the device has no connectivity at all.
  //
  //    Phase 47 — scope the fallback to the CURRENT cache bucket and
  //    match with `ignoreSearch: true`. The old `caches.match(...)`
  //    searched EVERY bucket in creation order, so a stale leaked
  //    bucket could serve an ancient index.html to an offline user.
  //    The current bucket is the only one that holds this release.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .catch(() => caches.open(CACHE).then((c) => c.match('/index.html')))
        .then((resp) => resp || caches.open(CACHE).then((c) => c.match('/index.html')))
    );
    return;
  }

  // 4) Other same-origin — cache-first with network fallback, then
  //    cache the fresh response (covers the SHELL entries themselves
  //    if the pre-cache step missed one for any reason).
  //
  //    Phase 47 — `ignoreSearch: true` is what makes the SHELL entries
  //    reachable. The page requests `/app.js?v=67` and `/style.css?v=41`,
  //    but SHELL stores them as `/app.js` and `/style.css` (the version
  //    lives in the bucket name), so an exact match never hit and the
  //    precached copies were written on install and then never served.
  //    Also scoped to the current bucket so a leaked stale bucket can't
  //    answer for it.
  if (reqUrl.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req, { ignoreSearch: true }).then((cached) => {
          if (cached) {
            return cached;
          }
          return fetch(req)
            .then((response) => {
              if (response && response.ok) {
                cache.put(req, response.clone());
              }
              return response;
            })
            .catch(() => new Response('', { status: 504, statusText: 'Offline' }));
        })
      )
    );
    return;
  }

  // 5) Other cross-origin — network only, never cache.
});

// ------------------------------------------------------------------
// Phase 42 — Web Push handlers.
//
// The client (src/utils/push-subscriptions.js + app.js settings UI)
// stores the subscription JSON in localStorage. Until a push server
// is wired up to actually deliver pushes, no `push` event will ever
// fire — but the SW must still have a `push` listener, otherwise the
// browser drops the event and the user gets nothing when the server
// does come online.
//
// Payload contract (server → SW):
//   {
//     "title":  string  — required; shown in the notification header.
//     "body":   string  — optional; shown beneath the title.
//     "tag":    string  — optional; collapses repeat notifications
//                         with the same tag (e.g. one per route).
//     "url":    string  — optional; opened on notification click.
//                         Defaults to the app root when absent.
//   }
//
// `event.data.json()` parses the payload. We deliberately do NOT
// `event.waitUntil` the `showNotification()` call — the OS owns the
// notification lifetime, not the SW — so we just call and return.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    if (event.data && typeof event.data.json === 'function') {
      payload = event.data.json();
    }
  } catch (_) {
    // Non-JSON payload — fall through to an empty default. We
    // intentionally swallow the parse error: the SW should never
    // throw on a malformed push, or the browser treats it as a
    // delivery failure and we get the same payload again.
    payload = {};
  }
  const title = (payload && payload.title) || 'BusETA HK';
  const options = {
    body: (payload && payload.body) || '',
    icon: '/assets/icon.svg',
    badge: '/assets/icon.svg',
    tag: (payload && payload.tag) || 'buseta-alert',
    data: {
      url: (payload && payload.url) || '/',
      tag: (payload && payload.tag) || 'buseta-alert',
    },
    // Per-app locale would be nicer, but the SW has no access to
    // state.lang; we accept English-fallback strings until a future
    // phase wires a localised payload. Phase 42 stays minimal.
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — focus the existing client (preserves the
// user's hash-route state) or open a new window pointing at
// `event.notification.data.url`. The notification itself always
// closes first so the OS-level badge clears.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          // Reuse an already-open tab if we can find one. We don't
          // compare URLs — the user may have navigated off the
          // notification's target since subscribing, and forcing a
          // hashchange feels jarring.
          if (w && typeof w.focus === 'function') {
            return w.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
        return null;
      })
      .catch(() => null)
  );
});
