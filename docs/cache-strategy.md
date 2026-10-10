# Service worker cache strategy

`sw.js` implements a tiered cache strategy across multiple buckets, each with its own freshness policy.

## Buckets

| Bucket | Contents | Strategy | TTL |
| --- | --- | --- | --- |
| `buseta-v{NN}` | App shell (HTML, JS, CSS, manifest, icons) | cache-first, network-fallback | Until SW version bump |
| `ASSET_CACHE` | Bundled data files (`hk-stops.json`, `mtr-stops.json`, …) | cache-first, network-fallback | Until bumped |
| `ETA_CACHE` | Live ETA responses (KMB / CTB / GMB / MTR) | SWR (stale-while-revalidate) | 5 min |
| `TD_DISRUPTION_CACHE` | TD XML disruption feed | SWR + `If-Modified-Since` | 24 h |

## Versioning

`const CACHE = 'buseta-v{NN}'` is bumped on every user-visible change so the activate handler drops the old bucket. NN is kept in sync with the `buseta-version` meta tag in `index.html`.

## Activate handler

```js
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (k) =>
              k.startsWith('buseta-v') &&
              k !== CACHE &&
              parseInt(k.split('-v')[1], 10) < NN
          )
          .map((k) => caches.delete(k))
      )
    )
  );
});
```

The four named buckets (`ASSET_CACHE`, `ETA_CACHE`, `TD_DISRUPTION_CACHE`, plus the versioned app-shell bucket) are kept across upgrades.

## SWR pattern (ETA)

```js
// SWR — return cached immediately, refresh in background
const cached = await cache.match(req);
const networkPromise = fetch(req).then((r) => {
  cache.put(req, r.clone());
  return r;
});
return cached || networkPromise;
```

Freshness is checked via an `x-sw-cached-at` timestamp header set by `timestampedResponse()` on cache write. Entries lacking the header fall through to the network on first request after a deployment.

## Disruption feed

The TD XML endpoint is fetched with `If-Modified-Since` on every cache hit. The server returns 304 if the feed hasn't changed (the cache stays valid) or 200 with a fresh body (the cache is rewritten).

## Offline behaviour

When the network is unreachable:

- **App shell** (`buseta-v{NN}`): served from cache. The app loads.
- **Bundled assets** (`ASSET_CACHE`): served from cache. Index rebuild works offline.
- **ETA endpoints** (`ETA_CACHE`): served from cache. Stale data shown with the existing UI ("as of X minutes ago").
- **TD disruptions**: served from cache. Up to 24 h stale.
- **GraphHopper walking**: NOT cached. Falls back to haversine estimate at 60 m/min.

## Purging on a version bump

When `CACHE = 'buseta-v43'` → `buseta-v44`, the activate handler drops the `buseta-v4*` buckets but keeps the named caches. Users get a fresh app shell with their old data caches intact — saved routes, recent searches, and the bundled data indexes all survive the upgrade.