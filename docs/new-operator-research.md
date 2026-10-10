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

**None**. Star Ferry's schedule + star + boat arrival info is only
available on their website (`starferry.com.hk`) as HTML. There
is no JSON endpoint, no documented API, no public data feed.

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
