# Upstream APIs

BusETA HK calls these public, unauthenticated, CORS-enabled endpoints. None are proxied through any backend. All are operated by the Hong Kong Transport Department or MTR Corporation.

## KMB / LWB

Base URL: `https://data.etabus.gov.hk/v1/transport/kmb/`

| Endpoint | Used for |
| --- | --- |
| `route/` | Static list of all KMB routes |
| `route/{route}/{direction}` | Stops along a KMB route |
| `stop/` | Static list of all KMB stops |
| `stop-eta/{stop_id}` | Live ETA at a KMB stop (internal 16-hex ID — **not** the operator-facing code) |
| `route-stop/{route}/{direction}/{service}` | Stops served by a specific KMB route / service |

LWB endpoints mirror KMB at the same base URL.

## Citybus / NWFB

Base URL: `https://rt.data.gov.hk/v2/transport/citybus/`

| Endpoint | Used for |
| --- | --- |
| `route/CTB` or `route/NWFB` | Static list of all CTB / NWFB routes |
| `stop/{id}` | Stops along a CTB / NWFB route |
| `eta/CTB/{id}` or `eta/NWFB/{id}` | Live ETA at a CTB / NWFB stop |
| `batch/stop-eta/CTB/{id}` | Batched ETA for a stop (used in v35 for the off-peak no-ETA card flow) |
| `company/CTB/{id}/` | Stop list for a CTB route |

## GMB (Green Minibus)

Base URL: `https://data.etagmb.gov.hk/v1/transport/gmb/`

| Endpoint | Used for |
| --- | --- |
| `route/` | Static list of all GMB routes |
| `route/{route_id}` | Stops along a GMB route |
| `stop/` | Static list of all GMB stops |
| `eta/{stop_id}` | Live ETA at a GMB stop |

## MTR (heavy rail)

Base URL: `https://rt.data.gov.hk/v1/transport/mtr/`

| Endpoint | Used for |
| --- | --- |
| `getSchedule.php?line=<LINE>&sta=<STA>` | Live schedule for an MTR station (e.g. `?line=TML&sta=HOM` for 屯馬線 · 何文田) |

Static catalogue comes from `https://opendata.mtr.com.hk/` (lines + stations CSV). Pre-parsed into `assets/mtr-lines.json` and `assets/mtr-stops.json` so the app doesn't need to fetch CSVs at runtime.

## Light Rail

LRT uses the same `/getSchedule.php` endpoint as MTR but with `line=LRTLIGHTRAIL`. Static route catalogue in `assets/lrt-routes.json`; static stop catalogue in `assets/lrt-stops.json`.

## TD disruption feed (experimental, currently unused)

Base URL: `https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Public_Transports.xml`

Cached by the service worker for 24 h with `If-Modified-Since` revalidation. v40 added the parser pipeline; v39 hid the rendered banner. Today the parser runs on every home-view mount but the result is discarded — the live pipeline is wired but unused. Re-enabling the banner is a one-line revert (drop the short-circuit in `fetchDisruptions()`).

## GraphHopper (walking)

Base URL: `https://routing.openstreetmap.de/routed-foot/route/v1/foot/`

Public demo server, no API key. v47 added `fetchRealWalkRoute()` for the trip planner's walk segments. On any failure, the planner falls back to a haversine estimate at 60 m/min.

## Rate limits

We do not know the upstream rate limits. The app is polite — it does not poll faster than the upstream refresh interval (60 s for stop ETA, daily for the TD feed). No exponential back-off has been needed in practice.

## Caching

Every response is routed through the service worker. See [cache-strategy.md](./cache-strategy.md) for the bucket layout, TTLs, and SWR revalidation.