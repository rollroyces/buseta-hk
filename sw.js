/* BusETA HK service worker
 * Strategy: pre-cache the app shell on install; cache-first with
 * network fallback for same-origin GETs; network-only for cross-origin
 * upstream API calls. Static JSON in /assets/ is cached lazily on first
 * fetch via the same code path.
 *
 * CACHE bumped to v32: forces a clean install after v44's
 * planner walking-segments on the route-shape canvas. App.js still
 * fetches the Transport Department's public-data XML feed; the
 * dedicated SW cross-origin branch below caches it under
 * TD_DISRUPTION_CACHE with a 24h TTL + If-Modified-Since so repeat
 * visits stay O(1) and don't spam the upstream on every home-view
 * mount.
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
const CACHE = 'buseta-v48';
const SHELL = ['/', '/index.html', '/app.js', '/style.css', '/manifest.json'];

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
          // Drop legacy `buseta-vN` for N < 44; keep v44 + ASSET_CACHE
          // + ETA_CACHE + TD_DISRUPTION_CACHE so existing offline data
          // survives. Also explicitly drop the poisoned `buseta-eta-v1`
          // cache (bumped to v2) so users on the v13-era poisoned SWR
          // cache stop getting empty-body responses back.
          keys
            .filter((k) => {
              if (k === 'buseta-eta-v1') return true; // poisoned, drop
              const m = /^buseta-v(\d+)$/.exec(k);
              if (m) return parseInt(m[1], 10) < 44;
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
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .catch(() => caches.match('/index.html'))
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
        return fetch(req)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE).then((cache) => cache.put(req, clone));
            }
            return response;
          })
          .catch(() => new Response('', { status: 504, statusText: 'Offline' }));
      })
    );
    return;
  }

  // 5) Other cross-origin — network only, never cache.
});
