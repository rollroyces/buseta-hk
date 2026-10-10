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

---

## Phase 38½ update — live endpoint probe (2026-10-11)

> Companion note to the Phase 37 research. Before opening a Phase 39
> "live `fetchTramETA(stopCode)` helper" PR, the maintainer re-probed
> the live Tramways endpoint to validate the assumptions in the
> original research. This section documents what was found and how it
> reshapes the original 4-PR arc.

### Probe methodology

```
date:           Sat, 10 Oct 2026 18:42–18:44 UTC (= 02:43–02:44 HKT)
tool:           curl 7.x via HTTPS
origin:         direct internet (no browser, no proxy)
probed stops:   KTT (terminus), SHW, CEN, WAC, CWB, TIH, QUB, DGC, 92W
probed paths:   /nextTram/geteat.php?stop_code=<code>
                /js/googleMap.js (the JS file the hongkong-trams
                npm wrapper evals to extract stop data)
```

### Findings

1. **Server is alive but barely functional.**
   `http://hktramways.com/nextTram/geteat.php?stop_code=KTT` returns
   HTTP 200 OK with body `<?xml version="1.0" encoding="utf-8"?><root/>`
   (i.e. an empty XML envelope — no `<metadata>` items, no ETAs).
   Server header: `Apache/2.2.31 + mod_ssl/2.2.31 + OpenSSL/1.0.1e-fips
   - PHP/5.3.26`. **All four components are end-of-life software**
     (Apache 2.2 EOL 2017, OpenSSL 1.0.1 EOL 2016 — pre-Heartbleed-patch
     version, PHP 5.3 EOL 2014). The combination has multiple known
     unpatched CVEs.

2. **The endpoint is empty for every probed stop.**
   `SHW`, `CEN`, `WAC`, `CWB`, `TIH`, `QUB`, `DGC`, `92W` all either
   time out (10 s) or return the same empty `<root/>` envelope. The
   happy-path XML from the `hongkong-trams` npm wrapper (with
   `<metadata eat=… eta=… is_arrived=… is_last_tram=…>` records)
   never appears in any of the responses. **The endpoint is either
   abandoned, rate-limited to a single trusted IP, or has been broken
   for a while and no one noticed.**

3. **No CORS headers.**
   `OPTIONS` preflight returns 200 OK but **no
   `Access-Control-Allow-Origin` header is set**. A browser-side
   `fetch('http://hktramways.com/nextTram/...')` from
   `rollroyces.github.io` would be blocked by the browser's same-
   origin policy even if the endpoint did return data. The
   `hongkong-trams` npm wrapper works because Node has no CORS.

4. **Mixed Content (HTTP vs HTTPS).**
   `hktramways.com` redirects `http://` → `https://` for the root page
   (302 → `Location: https://hktramways.com/`). But the data endpoints
   themselves (`/nextTram/geteat.php`, `/js/googleMap.js`) are served
   over plain HTTP. Our deployed app is HTTPS (GitHub Pages); a
   `fetch()` to plain HTTP would be blocked by the browser's mixed-
   content policy in addition to CORS.

5. **`/js/googleMap.js` is still served.**
   `Last-Modified: Thu, 04 Mar 2021 04:46:15 GMT` — three years stale
   on a file that the npm wrapper `eval()`s for stop data. If we ever
   did want to populate `assets/tram-stops.json` from the upstream,
   this is the file to scrape. But scraping it once and committing
   the result as JSON is already what Phase 38's bundled catalogue
   does — there's no incremental value to a runtime scrape.

### Why Phase 39 as-planned is not viable

The Phase 37 doc proposed Phase 39 as "live `fetchTramETA(stopCode)`
helper + tests" — a layered enhancement on top of the Phase 38
bundled stub. The probe invalidates this:

- The live endpoint returns no data for any probed stop (empty
  `<root/>` or 10-second timeout). A live helper would always return
  `[]` — no better than the bundled stub already in place, and
  worse because of the latency.
- Even if the endpoint came back to life, CORS + mixed-content rules
  prevent browser-side fetches. A CORS proxy (e.g. Cloudflare Worker,
  GitHub Action, allorigins.win) is the only path, and each adds an
  ops surface the maintainer can't responsibly maintain.
- The endpoint's server runs EOL software with known unpatched CVEs.
  Building a feature on top of it means inheriting the risk — and
  when the upstream goes down (more a question of when than if),
  the feature silently breaks.

### Rescope matrix

The original 4-PR arc (Phase 38 bundled → Phase 39 live → Phase 40 UI
→ Phase 41 route catalogue) had Phase 39 as the technical-risk leg.
With Phase 39 unviable, three viable rescopes exist:

| Option                               | What changes                                                                                                                                                                                                                 | Pros                                                                                  | Cons                                                                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Drop live fetch, skip to UI**   | Drop Phase 39. Phase 40 (UI integration) consumes the Phase 38 bundled stub directly — operator filter chip, tram-stop card variant, etc. Phase 41 (route catalogue) follows.                                                | Smallest surface, no CORS proxy, no EOL dependency, Phase 38 ships user value sooner. | No live ETAs — UI shows static "next tram not available" message (or relies on the bundled stop list as a directory).                              |
| **B. Add a thin CORS-proxy + cache** | Phase 39 becomes "GitHub Actions cron that scrapes the endpoint server-side every 5 min and commits a tiny `assets/tram-eta-cache.json` snapshot to the repo". Browser reads the bundled snapshot, gets stale-but-real ETAs. | Real-ish data, browser stays pure, no runtime CORS issue.                             | Adds a backend-ish surface (cron + repo write), adds a CI secret for the push, and the upstream is still EOL — when it dies, so does the snapshot. |
| **C. Defer the entire Trams arc**    | Pause. Re-evaluate in 6 months when/if the upstream stabilises.                                                                                                                                                              | Zero risk; respects the user's gate.                                                  | No new feature this round; the bundled stub already shipped in Phase 38 ships with no consumer.                                                    |

### Recommendation: Option A

Drop Phase 39 (live fetch) entirely. Phase 38's bundled stub becomes
the always-on data source. Phase 40's UI integration becomes the next
PR — it consumes the bundled stub and surfaces trams as a directory
operator (similar to how MTR renders but without live ETAs, since
none are available).

If the upstream comes back to life later (and someone notices via the
hamtram.com.hk homepage), a future maintainer can revive Phase 39
under the original spec — the Phase 38 stub is forward-compatible
with that path.

### Updated arc if Option A is accepted

1. **Phase 38** (already shipped via PR #39): bundled
   `assets/tram-stops.json` + i18n STRINGS + `src/utils/trams.js`
   stub. ✓
2. **Phase 39** _(new)_: **dropped** per the rescope above.
3. **Phase 40** _(next)_: trams-aware UI integration. Operator filter
   chip on the home view, "tram stop" card variant in the stop view,
   route-style links to nearby tram stops via the existing
   `routesByStop` pipeline. Consumes the Phase 38 bundled stub.
4. **Phase 41** _(deferred)_: route catalogue + tram-route card.
   Lower priority without live ETAs to anchor the user journey;
   revisit only if/when the upstream is revived.

### What this update does NOT do

- Does not modify `app.js`, `planner.js`, `index.html`, `sw.js`, or
  any `src/utils/*.js`.
- Does not bump cache-busters (docs only).
- Does not add tests (no code change).
- Does not propose a specific implementation for Phase 40 — that's
  its own PR after the maintainer accepts the Option A rescope.

### Probe artifact (curl session, verbatim)

```
$ curl -sS -i 'http://hktramways.com/nextTram/geteat.php?stop_code=KTT'
HTTP/1.1 200 OK
Server: Apache/2.2.31 (Unix) mod_ssl/2.2.31 OpenSSL/1.0.1e-fips DAV/2 PHP/5.3.26
X-Powered-By: PHP/5.3.26
Content-Type: text/html
Content-Length: 47

<?xml version="1.0" encoding="utf-8"?>
<root/>

$ curl -sS -i -X OPTIONS -H "Origin: https://rollroyces.github.io" \
        -H "Access-Control-Request-Method: GET" \
        'http://hktramways.com/nextTram/geteat.php?stop_code=SHW'
HTTP/1.1 200 OK
Server: Apache/2.2.31 (Unix) mod_ssl/2.2.31 OpenSSL/1.0.1e-fips DAV/2 PHP/5.3.26
X-Powered-By: PHP/5.3.26
Content-Type: text/html
Content-Length: 47

<?xml version="1.0" encoding="utf-8"?>
<root/>

$ curl -sS -i 'https://hktramways.com/nextTram/geteat.php?stop_code=SHW'
HTTP/1.1 200 OK
# (same empty body — HTTPS works but CORS still absent)

$ curl -sS -i 'http://hktramways.com/js/googleMap.js'
HTTP/1.1 200 OK
Last-Modified: Thu, 04 Mar 2021 04:46:15 GMT
Content-Length: 23090
Content-Type: application/javascript

var map;
/*var markerArray = [ ... ]*/     # (eval-target for hongkong-trams)
```

### References

- Original Phase 37 research (this doc, above) — proposed the 4-PR arc
- `hongkong-trams` npm wrapper — <https://www.npmjs.com/package/hongkong-trams>
  (its `index.js` source confirms the XML-on-`/nextTram/geteat.php`
  shape; the README's "all methods return JSON" claim refers to the
  wrapper's caller-facing API, not the upstream wire format)
- Phase 38 bundled stub (PR #39) — `assets/tram-stops.json` +
  `src/utils/trams.js`
