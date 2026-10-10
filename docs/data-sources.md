# Data sources (bundled assets)

These files ship with the app and are fetched on first use, then cached in `localStorage` (the parsed index) and the service worker (the raw bytes).

## Inventory

| File | Size | Refresh | Purpose |
| --- | --- | --- | --- |
| `assets/hk-stops.json` | ~670 KB | Rarely (curated) | Lat/lng for 5,160+ GMB / MTR / NLB stops |
| `assets/hk-stops.json.gz` | ~185 KB | Same as above | gzipped sibling — served via `Accept-Encoding: gzip` |
| `assets/mtr-stops.json` | ~7 KB | Rarely (curated) | 97 MTR stations with coordinates |
| `assets/lrt-stops.json` | ~4 KB | Rarely (curated) | 67 LRT stops with coordinates |
| `assets/mtr-lines.json` | ~26 KB | Rarely | Pre-parsed MTR line catalogue (avoids CORS-restricted CSV fetch) |
| `assets/lrt-routes.json` | ~36 KB | Rarely | Pre-parsed Light Rail route catalogue |
| `assets/kmb-fares.json` | ~5 KB | Occasionally | KMB fare table |
| `assets/ctb-fares.json` | ~1 KB | Occasionally | CTB fare table |
| `assets/gmb-fares.json` | ~1 KB | Occasionally | GMB fare table |
| `assets/lrt-fares.json` | ~1 KB | Occasionally | LRT fare table |
| `assets/mtr-fares.json` | ~7 KB | Occasionally | MTR fare table |
| `assets/disruptions.json` | ~5 KB | Unused today | Hand-curated disruption notices (v39 hid the banner) |
| `assets/icon.svg` | ~1 KB | Never | Bus mark icon |
| `assets/favicon.svg` | ~1 KB | Never | Favicon |
| `assets/qrcode.js` | ~23 KB | Never | Local QR code generator (no external dep) |
| `assets/vehicle-positions.js` | ~8 KB | Never | Future-use vehicle position helpers |
| `assets/config.example.json` | ~1 KB | Never | Optional site-wide config template |

## Schema versioning

`app.js` carries `INDEX_SCHEMA_VERSION`. When the shape of `state.index` changes (e.g. adding the LRT stops overlay in v45), the version bumps. Any cached `state.index` from a prior visit is discarded and rebuilt from the bundled assets on the next page load.

| `INDEX_SCHEMA_VERSION` | What changed |
| --- | --- |
| 1–3 | Initial pre-public-development versions |
| 4 | GMB / MTR / NLB stop overlay |
| 5 | LRT stop overlay (v45) |

## Stop coordinates

For HK bus stops, the upstream operator data omits lat/lng for most GMB and NLB stops. The bundled `assets/hk-stops.json` is a curated file (compiled from public sources) that supplies those coordinates. This is the only non-trivial asset in the repo and the primary reason page weight is ~190 KB on first use.

## Update workflow

These files are updated manually by the maintainer when:

- A new operator opens for data (rare)
- The upstream operator changes a stop name / ID (occasional)
- A new MTR / LRT station opens (rare)
- A fare changes (occasional)

There is no automated refresh.