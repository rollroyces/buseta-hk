# Operator coverage

The operators currently supported by BusETA HK, with the data source and any caveats.

## Supported operators

| Operator | Local name | Mode | Data source | Real-time ETA | Notes |
| --- | --- | --- | --- | --- | --- |
| KMB | 九巴 | Bus (Kowloon) | data.etabus.gov.hk | ✅ | Operator-facing codes resolved to internal 16-hex via `kmbOperatorId` reverse map (v36) |
| LWB | 龍運 | Bus (Lantau) | data.etabus.gov.hk | ✅ | Same base URL as KMB |
| Citybus | 城巴 | Bus (HK Island / Kowloon) | rt.data.gov.hk | ✅ | Parity added in v35 |
| NWFB | 新巴 | Bus (HK Island) | rt.data.gov.hk | ✅ | Merged into Citybus route IDs |
| GMB | 專線小巴 | Minibus | data.etagmb.gov.hk | ✅ | Lat/lng bundled in `hk-stops.json` (curated) |
| MTR | 港鐵 | Heavy rail | rt.data.gov.hk | ✅ (4 next trains per direction) | Static catalogue from opendata.mtr.com.hk |
| LRT | 輕鐵 | Light rail | rt.data.gov.hk | ✅ | Lat/lng curated in `lrt-stops.json` (v45) |

## Not currently supported

| Operator / mode | Local name | Why not | Open an issue? |
| --- | --- | --- | --- |
| Tram | 電車 | No public real-time API | ✅ Use the operator-coverage issue template |
| Peak Tram | 山頂纜車 | No public real-time API | ✅ |
| Star Ferry | 天星小輪 | No public real-time API | ✅ |
| MTR Bus (feeder) | 港鐵巴士 | No public real-time API distinct from MTR | ✅ |
| Cross-border coach | 跨境巴士 | Out of scope (geographic) | — |

## How to request a new operator

Open an issue using the **operator-coverage** template. Include the operator name, a link to the public data source, and notes on data quality (real-time / CORS / API key / lat-lng).

## Operator coverage history

- **v53** — desktop bottom-nav fix (2026-10-07)
- **v52** — mixed bus + rail journeys in the trip planner
- **v45** — LRT curated stops (lat/lng overlay)
- **v40** — TD XML disruption feed pipeline (parsed but not yet surfaced)
- **v36** — KMB operator-facing → internal stop ID resolution
- **v35** — Citybus parity (live ETA + no-ETA cards)
- **v34** — friendly-fallback for unresolvable stops across all operators