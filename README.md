# BusETA HK · 巴士到站

> Real-time Hong Kong bus arrivals — KMB / LWB / Citybus. Mobile-first, bilingual (繁體中文 / English), zero build step.

A small, fast web app that shows live bus arrival estimates for Hong Kong. Tap a route number, a stop name, or your location to see the next bus.

## Features

- 🔎 **Search** routes by number (e.g. `1`, `970`, `A20`) or stops by name (English / 繁體)
- 🚌 **Route detail** with every stop along the route and live ETAs at the next stops
- 🚏 **Stop detail** with every route serving that stop, sorted by arrival time
- ⭐ **Save routes and stops** locally (localStorage, no account required)
- 🕒 **Recent searches** for quick re-entry
- 📍 **Nearby stops and routes** using browser geolocation (opt-in)
- 🌐 **Bilingual** — Traditional Chinese (default) and English
- 📱 **Mobile-first** with a sticky bottom nav, safe-area aware, dark-mode friendly

## Data sources

- [KMB / LWB routes, stops, and real-time ETA](https://data.etabus.gov.hk/) — Transport Department Data One
- [Citybus (CTB + NWFB) routes](https://rt.data.gov.hk/v2/transport/citybus/) — Transport Department Data One
- Fares referenced in the UI footer use the [Public Transport Route and Fare](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb) dataset

All data is fetched live from public APIs (CORS-enabled) — no key required.

## Tech

Pure static site:

- `index.html` — single-page shell with templates per view
- `style.css` — modern mobile-first CSS, dark-mode aware
- `app.js` — vanilla JS (no framework, no build step)
- `assets/icon.svg` — bus mark icon
- `assets/favicon.svg` — favicon

Total page weight: ~70 KB before first paint, no external dependencies.

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

The app does not track you. It uses `localStorage` for saved routes/stops and
the Geolocation API only when you tap into the search tab (and only on the
client). No analytics. No accounts. No server.

## License

MIT — see [LICENSE](./LICENSE).

## Attribution

Made by Royce. Data: Transport Department Data One (data.gov.hk). Bus routes
operated by Kowloon Motor Bus (KMB), Long Win Bus (LWB), Citybus, and New
World First Bus (NWFB).
