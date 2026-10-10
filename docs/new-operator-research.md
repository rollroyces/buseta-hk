# New operator research — what's feasible to add next

> Status: **research only**. No code or tests land with this PR — it's
> a design-doc that surfaces upstream availability + integration
> questions for the maintainer. Decisions about _whether_ to add
> any of these and _how_ they fit in the existing UX are deferred
> to a follow-up PR after the maintainer weighs in.

This doc is the companion to the "new operator" backlog item (PR
#9 / PR #21's CHANGELOG). It maps three candidates — Hong Kong
Tramways, Star Ferry, Peak Tram — against the project's actual
constraints (vanilla JS, no backend, unauthenticated public APIs).

## TL;DR

| Operator           | Public API?                                                               | Status                                 |
| ------------------ | ------------------------------------------------------------------------- | -------------------------------------- |
| Hong Kong Tramways | ✅ Yes — endpoints wrapped by `hongkong-trams` npm package                | **Best candidate**                     |
| Star Ferry         | ⚠️ No public API — only HTML scraping (against project policy per README) | Not feasible without a policy decision |
| Peak Tram          | ⚠️ No public API — only HTML scraping                                     | Not feasible without a policy decision |

**Recommendation**: open a follow-up PR to add Hong Kong Tramways
support. Defer Star Ferry / Peak Tram indefinitely.

## Constraint recap

From [README.md](../README.md) and [CONTRIBUTING.md](../CONTRIBUTING.md):

> **Data sources**: only the unauthenticated, CORS-enabled public
> APIs listed in the README's "Data sources" table.

> **What won't be merged**: real-time data from sources not
> listed in the README's "Data sources" table — without
> discussion first.

So a new operator needs either an existing public API or a
policy decision to add HTML scraping.

## Hong Kong Tramways — detailed

### What it is

Hong Kong's iconic double-decker street trams, running on Hong
Kong Island between Kennedy Town and Shau Kei Wan (plus a Happy
Valley loop). Six routes. Trams every 1-3 minutes at peak.

### Public API

The Tramways company has made a small set of public endpoints
available (no auth, no key) — same model as the other operators
in this project. The endpoints return JSON describing:

- `getTramStops()` — full stop catalogue with bilingual names +
  stop codes (e.g. `92W`, `KTT`)
- `getNextTramETA(stopCode)` — next 3 trams arriving at a stop,
  with destination, ETA in seconds, "is last tram" flag
- `getEmergencyMessageForTramStop(stopCode)` — service alerts
  per stop
- `getServiceUpdates()` — system-wide service status
- `getFares()` — fare table (Adult / Child / Senior Octopus fares)
- `getSchedules()` — timetable per route

The endpoint URL isn't officially documented but is wrapped by
the open-source `hongkong-trams` npm package
(<https://www.npmjs.com/package/hongkong-trams>) and reverse-
engineered by community projects. There is no SLA, no uptime
commitment, no terms-of-service — the same caveat that applies
to `data.etabus.gov.hk` for KMB.

### Coverage gap

Today the app supports:

- KMB / LWB (data.etabus.gov.hk)
- Citybus / NWFB (rt.data.gov.hk/v2/transport/citybus/)
- GMB / Green Minibus (data.etagmb.gov.hk)
- MTR heavy rail + Light Rail (rt.data.gov.hk/v1/transport/mtr/)
- Ferry — **none** despite the README listing some ferry data
  source as future work

Hong Kong Island residents who take the tram to the MTR would
benefit from real-time tram ETAs at the tram stops near MTR
stations.

### Integration shape (proposed, not committed)

A new module `src/utils/trams.js` with helpers:

```js
// Phase 38+ candidate — design only
export async function fetchTramStops()
export async function fetchTramETA(stopCode)
export async function fetchTramServiceUpdates()
```

Plus:

- A new operator discriminator (`opCoKey` or equivalent)
  returning `trams` for the new constant `CO.TRAMS`
- A bundled `assets/tram-stops.json` (catalogue — same model as
  the existing `mtr-stops.json`)
- A route-card rendering for the new operator (similar to
  the existing MTR card but with tram-specific styling)
- Cache-buster bumps per `docs/cache-strategy.md`
- Tests for each helper (jsdom + fetchJSON pattern from
  `src/utils/network.js`)

### Risks

1. **Terms-of-service unclear** — the Tramways company hasn't
   published an explicit ToS for programmatic access. If they
   object, the feature would have to come down. Mitigation: rate
   limit aggressively (cache ETAs for 30s, catalogue for 24h).
2. **Endpoint volatility** — the API is undocumented. URL or
   payload shape could change without notice. Mitigation: detect
   schema regressions in tests; fall back to the bundled
   `assets/tram-stops.json` if the API is unreachable.
3. **Bilingual stop names** — would need both zh-Hant + en for
   every stop. If the upstream doesn't provide both, fall back
   to the bundled JSON.
4. **i18n parity** — adding `trams` operator requires STRINGS
   entries ("tram" / "電車" / "电车", "Next tram", "Route 92W",
   "Last tram", etc.). `npm run lint:i18n` enforces all three
   lang blocks.

## Star Ferry — detailed

### What it is

Star Ferry runs between Kowloon (Tsim Sha Tsui) and Hong Kong
Island (Central / Wan Chai). 6 routes total. Iconic tourist
service, ~20 minute frequency.

### Public API

**None directly browser-fetchable**. Star Ferry's schedule +
star + boat arrival info is only available on their website
(`starferry.com.hk`) as HTML. There is no JSON endpoint, no
documented API, no public data feed accessible from JavaScript.

### Integration feasibility

Adding Star Ferry would require HTML scraping — extracting
schedule + arrival data from the rendered DOM. This conflicts
with the project's policy:

> **What won't be merged**: real-time data from sources not
> listed in the README's "Data sources" table — without
> discussion first.

The Tramways API gets a pass because it returns JSON; Star
Ferry's HTML page would not.

### Recommendation

Do not pursue without an explicit maintainer policy decision to
loosen the "JSON-only" rule, OR a future API release from Star
Ferry.

## Peak Tram — detailed

### What it is

The Peak Tram is a funicular railway between Central (Garden
Road) and Victoria Peak. Single route, ~10-15 minute frequency.

### Public API

**None** in the same sense as Star Ferry. The Peak Tram Company
publishes schedule and ticketing info on their website
(`thepeaktram.com.hk`) as HTML.

There's also a third-party route planner integration via the
government's data.gov.hk portal for some "Peak Tram" data, but
it's a static timetable CSV, not real-time ETA — same as the
already-supported LRT (Light Rail).

### Integration feasibility

Same as Star Ferry — would require either HTML scraping or a
policy decision to add static timetable-only support (which
the LRT already does for some routes).

### Recommendation

Defer indefinitely. The Peak Tram's single-route, ~15-min
frequency makes real-time ETA low-value anyway — users don't
need it for trip planning the way they do for buses.

---

## Phase 37½ update — Star Ferry / Peak Tram discovery (2026-10-11)

> Companion note to the Phase 37 doc. The maintainer re-checked
> `data.gov.hk` for structured Star Ferry + Peak Tram datasets
> before declaring the candidates permanently infeasible. The
> investigation found that structured data **does exist** for all
> three operators the Phase 37 doc flagged — but it's behind a
> CloudFront auth gate that prevents direct browser-side fetches.
> This closes the "Star Ferry / Peak Tram not feasible" finding
> with a more accurate picture: the data is available, the
> transport is gated, but a bundled-snapshot approach (same model
> as Phase 38's `assets/tram-stops.json`) is viable.

### What was investigated

The Phase 37 doc only considered each operator's own website
(`starferry.com.hk`, `thepeaktram.com.hk`). The maintainer
checked `data.gov.hk` for any official structured datasets
covering these operators.

### Findings

**1. Star Ferry has an official data.gov.hk dataset.**

- Dataset: <https://data.gov.hk/en-data/dataset/starferry-starferry-ferry-service-timetables-and-fare-tables-of-star-ferry>
- Data provider: The "Star" Ferry Company, Limited (not Transport Department)
- Format: CSV + XLSX (3 locales × 12 routes = 36 individual files)
- Coverage: Central/TST timetable + fare table, Wan Chai/TST
  timetable + fare table — all in English, 繁體中文, 简体中文
- Last updated: 02/06/2026 (4 months ago — relatively fresh)
- CDN: <https://www.starferry.com.hk/sites/default/files/upload/open_data/csv/...>

**2. Peak Tram + Ferry + Tram are in the Transport Department's
aggregated routes-and-fares dataset.**

- Dataset: <https://data.gov.hk/en-data/dataset/hk-td-tis_3-routes-and-fares-of-public-transport>
  (XML/CSV) / `hk-td-tis_23-routes-fares-geojson` (GeoJSON) /
  `hk-td-tis_24-routes-fares-kml` (KML)
- Data provider: Transport Department (TD)
- Format: CSV / XML / GeoJSON / KML (depending on variant)
- Frequency: biweekly (so the data is regularly refreshed)
- Coverage: route list + stop sequence + section fare + stop
  coordinates for ferry, peak tram, tram (in addition to bus,
  GMB)

**3. All three operators' direct CDN paths are blocked.**

```
$ curl -sS -i 'https://www.starferry.com.hk/sites/default/files/upload/open_data/csv/ferry_sf_central_tsimshatsui_timetable_eng.csv'
curl: (52) Empty reply from server     # Star Ferry CDN is broken

$ curl -sS -i 'https://static.data.gov.hk/td/routes-fares-geojson/Route_PT_PeakTram.json'
HTTP/1.1 403 Forbidden                  # CloudFront denies programmatic access

$ curl -sS -i -A "Mozilla/5.0 ..." 'https://static.data.gov.hk/td/routes-fares-geojson/Route_PT_Tram.json'
HTTP/1.1 403 Forbidden                  # Same — User-Agent doesn't help

$ curl -sS -i 'https://static.data.gov.hk/td/routes-and-fares/ROUTE_PEAK_TRAM.csv'
HTTP/1.1 403 Forbidden                  # Same — TD direct CSV path also gated

$ curl -sS 'https://static.data.gov.hk/td/routes-and-fares/ROUTE_TRAM.csv'
ROUTE_ID,CHANGE                         # Empty body (just header, no rows)

$ curl -sS -i 'https://portal.csdi.gov.hk/api/v1/dataset/?q=ferry'
HTTP/1.1 301 Moved Permanently          # CSDI Portal is JS-driven, not a REST API
```

Same EOL-software / auth-gate pattern as the Phase 38½ finding
for Trams — data exists, runtime fetch doesn't.

### Why this changes the Phase 37 conclusion

The Phase 37 doc concluded:

> **Star Ferry** — Not feasible without a policy decision.
> **Peak Tram** — Not feasible without a policy decision.

Both were deemed HTML-only. The new finding shows both have
**structured public data published on data.gov.hk** — the data
exists, it just isn't accessible via direct runtime fetch.

This doesn't make runtime integration possible (same CORS / auth
issues as Phase 38½'s Trams finding), but it **does** open a
bundled-snapshot path:

1. Maintainer fetches the CSV / XLSX / GeoJSON once via the
   `data.gov.hk` web UI (authenticated browser session, the
   human-friendly path).
2. Converts to JSON shape mirroring `assets/mtr-stops.json` /
   `assets/tram-stops.json`.
3. Commits as `assets/star-ferry-{routes,pi-timetables}.json` +
   `assets/peak-tram-{routes,pi-stops}.json`.
4. App consumes the bundled JSON exactly like it consumes the
   Phase 38 tram stub — same `fetchStops()` / `fetchRoutes()`
   pattern, shape-validated, null on failure, cache-busted per
   `docs/cache-strategy.md`.

### Bonus: TD's Tram data can cross-validate Phase 38's stub

The Transport Department's GeoJSON Tram dataset (if accessible
via the web UI) lists official tram stop coordinates. The Phase 38
bundled `assets/tram-stops.json` was curated from the published
track layout. A future PR can:

1. Fetch the TD Tram GeoJSON via the web UI.
2. Cross-check the 24 curated stop coordinates against TD's
   official positions.
3. Either confirm the curation or expand the bundled set with
   stops we missed (e.g., the Admiralty mid-block stops, the Wan
   Chai mid-block stops that Phase 40's design doc flagged as a
   gap).

This is a Phase 42+ cleanup item, not a Phase 38 follow-up
(shipping the bundled stub now is the right call regardless of
whether TD's data is reachable).

### Updated feasibility matrix

| Operator   | Phase 37 verdict         | Phase 37½ verdict                            | Path forward                                                                                                                                                   |
| ---------- | ------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Star Ferry | Not feasible (HTML-only) | **Feasible as bundled snapshot**             | One-time data.gov.hk fetch → `assets/star-ferry-*.json` → same pattern as Phase 38. Phase 42+ candidate.                                                       |
| Peak Tram  | Not feasible (HTML-only) | **Feasible as bundled snapshot**             | One-time data.gov.hk fetch → `assets/peak-tram-*.json` → same pattern. Phase 43+ candidate (lower priority — single-route, ~15-min frequency, low user value). |
| Tram       | Best candidate           | Best candidate (already shipped in Phase 38) | ✓ Done                                                                                                                                                         |

### What this update does NOT do

- Does not modify `app.js`, `planner.js`, `index.html`, `sw.js`,
  or any `src/utils/*.js`.
- Does not bump cache-busters (docs only).
- Does not actually fetch the Star Ferry / Peak Tram datasets —
  that's a Phase 42+ implementation PR after the maintainer
  weighs in on whether bundled-snapshot support for non-rail
  operators is desirable.
- Does not propose HTML scraping as a workaround. The data.gov.hk
  CSV / GeoJSON path is the canonical source.

### Probe artifact (curl session, verbatim)

See the "Findings" section above. The 5 distinct probe failures
establish that direct runtime access is blocked, matching the
Phase 38½ Trams pattern.

### References

- Original Phase 37 research (this doc, above) — proposed the
  HTML-only conclusion that's now superseded
- [`docs/new-operator-research.md`](./new-operator-research.md)
  (Phase 38½ section) — same auth-gate pattern for Trams
- data.gov.hk Star Ferry dataset — see link above
- data.gov.hk Transport Department routes/fares dataset — see
  link above
- `assets/tram-stops.json` — the bundled-snapshot pattern that
  Star Ferry + Peak Tram would mirror

## Decision matrix for the maintainer

Before opening a "Phase 38: add Trams" PR, the maintainer
needs to weigh:

| Question                                             | Yes path                                                                          | No path                                           |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| Is the Hong Kong Tramways API acceptable to rely on? | Add `src/utils/trams.js` + bundle + tests + cache discipline                      | Defer                                             |
| Are the upstream stop names reliably bilingual?      | Bundle as JSON fallback + use upstream live                                       | Skip bilingual in live, fall back to bundled only |
| Are we OK with an undocumented upstream?             | Add a graceful fallback (`fetchJSON` returns null on schema change → use bundled) | Skip                                              |
| Where does the new operator fit in the search UI?    | Add to route list (next to MTR); new "Tram" tab if ambitious                      | Skip                                              |

## If you decide to add Trams

A reasonable Phase 38 plan (each its own PR, atomic):

1. **Phase 38**: `assets/tram-stops.json` + i18n STRINGS entries
   for the `trams` operator + `src/utils/trams.js` with one helper
   (`fetchTramStops` against the bundled JSON; no upstream yet).
2. **Phase 39**: `fetchTramETA(stopCode)` + tests + cache
   discipline for the new file. Touches `app.js` + `sw.js` +
   `index.html`.
3. **Phase 40**: integrate into the route-search / stop-view
   flows. Touches `app.js` substantially; needs design sign-off
   for where trams show up in the UI.
4. **Phase 41**: add `assets/tram-routes.json` for the route
   catalogue; add a tram-route card to the UI.

Total: 4 PRs over the same atomic-per-phase discipline we've
been using since #1.

## What this PR does NOT do

- Does not add `hongkong-trams` as a dependency. If we decide to
  integrate Trams, we'd inline-call the API from `src/utils/trams.js`
  (same model as the existing `src/utils/network.js`), not pull
  the npm package — keeping with the project's "no build step,
  no transitive deps where avoidable" rule from CONTRIBUTING.md.
- Does not modify `app.js` / `planner.js` / `index.html`.
- Does not add cache-buster bumps (docs only).

## References

- Hong Kong Tramways: <https://www.hamtram.com.hk/>
- `hongkong-trams` npm wrapper: <https://www.npmjs.com/package/hongkong-trams>
- Star Ferry: <https://www.starferry.com.hk/>
- Peak Tram: <https://www.thepeaktram.com.hk/>
- Existing project README data sources table:
  <https://github.com/rollroyces/buseta-hk#data-sources>
- `docs/cache-strategy.md` — discipline for the new asset /
  cache-buster knobs
- `CONTRIBUTING.md` — "what won't be merged" rules
