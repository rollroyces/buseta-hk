# BusETA HK · 巴士到站

> Real-time Hong Kong transit arrivals — KMB / LWB / Citybus / Minibus / MTR. Mobile-first, bilingual (繁體中文 / English), zero build step.

A small, fast web app that shows live arrival times across Hong Kong's major public transit modes. Tap a route number, a stop name, or your location to see what's coming next.

## Features

- 🔎 **Search** bus routes (e.g. `1`, `970`, `A20`), MTR stations (e.g. `Central`, `金鐘`, `TML`), Light Rail routes (e.g. `505`, `615P`), or stops by name (English / 繁體)
- 🚌 **Route detail** with every stop along the route and live ETAs at the next stops (KMB / LWB / Citybus / Minibus / Light Rail)
- 🚇 **MTR station detail** with the next four trains in each direction (UP / DOWN / 屯馬 / LMC, …) and platform numbers
- 🚏 **Stop detail** with every route serving that stop, sorted by arrival time
- ⭐ **Save routes, stops and stations** locally (localStorage, no account required)
- 🕒 **Recent searches** for quick re-entry
- 📍 **Nearby stops, routes and MTR stations** using browser geolocation (opt-in)
- 🌐 **Bilingual** — Traditional Chinese (default) and English
- 📱 **Mobile-first** with a sticky bottom nav, safe-area aware, dark-mode friendly

## Data sources

| Source                                                                   | Used for                                                         | Provider                                                                                                              |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [data.etabus.gov.hk](https://data.etabus.gov.hk/v1/transport/kmb/)       | KMB / LWB routes, stops, real-time ETA                           | Transport Department Data One                                                                                         |
| [rt.data.gov.hk · Citybus](https://rt.data.gov.hk/v2/transport/citybus/) | Citybus + NWFB routes and ETA                                    | Transport Department Data One                                                                                         |
| [data.etagmb.gov.hk](https://data.etagmb.gov.hk/)                        | Green minibus (GMB / 專線小巴) routes, stops, ETA                | Transport Department Data One                                                                                         |
| [rt.data.gov.hk · MTR](https://rt.data.gov.hk/v1/transport/mtr/)         | MTR heavy rail + Light Rail real-time schedule                   | MTR Corporation (via data.gov.hk)                                                                                     |
| [opendata.mtr.com.hk](https://opendata.mtr.com.hk/)                      | MTR / Light Rail line + station static catalogue                 | MTR Corporation                                                                                                       |
| `assets/hk-stops.json`                                                   | Curated lat/lng for GMB stops + MTR stations + (bonus) NLB stops | Compiled from public sources; included as a local asset so the app has no runtime dependency beyond the official APIs |

All runtime API calls are unauthenticated and CORS-enabled. Stop coordinates for GMB, MTR stations and (where available) Light Rail stops are bundled in `assets/` so the app can offer accurate nearby stops out-of-the-box.

## Google Maps per stop

Every stop / station view that has lat/lng coordinates gets a live embedded
Google Map at the **bottom** of the page (under the live arrivals list):

- A 250 px tall card with a fully interactive `maps.google.com/maps?q=…&output=embed` iframe — full pan/zoom/satellite-thumb UI, no API key required.
- A red pin-icon "Open in Google Maps" link underneath that opens `maps.google.com` in a new tab.

This uses Google's [legacy iframe URL pattern](https://developers.google.com/maps/documentation/embed/get-started), so it works on day one with zero setup. Sites that want a slightly nicer embed can still add a `gmapsKey` to `assets/config.json`; the iframe gets a `&key=` parameter but still works without one.

## Tech

Pure static site:

- `index.html` — single-page shell with templates per view
- `style.css` — modern mobile-first CSS, dark-mode aware
- `app.js` — vanilla JS (no framework, no build step)
- `assets/hk-stops.json` — 5,160+ transit stop coordinates (GMB / MTR / NLB)
- `assets/mtr-stops.json` — 97 MTR stations with coordinates
- `assets/mtr-lines.json` / `assets/lrt-routes.json` — pre-parsed line + route catalogues (avoids CORS-restricted CSV fetches)
- `assets/config.example.json` — optional site-wide config (Google Maps key, …)
- `assets/icon.svg` — bus mark icon
- `assets/favicon.svg` — favicon

Page weight: ~75 KB before first paint, plus the ~190 KB stop-coordinate asset fetched on first use (cached in `localStorage` after that). No runtime dependencies.

## Running locally

No build step. Open `index.html` via any static server:

```bash
# python
python3 -m http.server 8765
# then open http://localhost:8765/

# or with node
npx serve .
```

(Opening `index.html` directly via `file://` works for the UI, but the API calls
may be blocked by CORS depending on the browser. Use a local server.)

## Deploy

Drop the contents of this directory into any static host (Netlify, Cloudflare Pages,
GitHub Pages, S3, etc.). The site uses hash routing (`#/...`) so no server-side
rewrite rules are needed.

## Privacy

The app does not track you. It uses `localStorage` for saved routes/stops/stations and
the Geolocation API only when you tap into the search tab (and only on the
client). No analytics. No accounts. No server.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the full per-PR release history
(Phases 1–20).

## License

MIT — see [LICENSE](./LICENSE).

## Attribution

Made by Royce. Real-time data: Transport Department Data One (data.gov.hk) and MTR Corporation (via data.gov.hk / opendata.mtr.com.hk). Operators: Kowloon Motor Bus (KMB), Long Win Bus (LWB), Citybus, New World First Bus (NWFB), green minibus operators, and MTR Corporation (heavy rail and Light Rail).
