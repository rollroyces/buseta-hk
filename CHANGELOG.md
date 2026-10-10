# Changelog

All notable changes to BusETA HK are recorded here. The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Versions reflect the `buseta-version` meta tag in `index.html` and the `CACHE` constant in `sw.js`.

## [Unreleased]

### Added

- **Phase 1 foundation** — `.github/workflows/ci.yml` (ESLint + Prettier + Vitest on push/PR), `.eslintrc.json`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `CONTRIBUTING.md`, this `CHANGELOG.md`, `package.json` (devDeps), `vitest.config.js`, `tests/setup.js`, `tests/unit/smoke.test.js`, README badges.
- No changes to production code (`app.js`, `planner.js`, `index.html`, `sw.js`).

## v53 — 2026-10-07

### Fixed

- Bottom-nav layout on desktop viewports (≥720 px). The mobile "floating glass pill" style was inherited, occluding the recent-search list. Now resets to a full-width bottom bar at desktop sizes.

### Changed

- Service-worker CACHE `buseta-v43` → `buseta-v44`.
- Cache-busters: `index.html` meta 54 → 55; `style.css?v=37` → `?v=38`.

## v52.2 — 2026-10-07

### Added

- `findNearestBusStop(idx, lat, lng, maxMeters)` helper next to the existing `findNearestMtrStop` / `findNearestLrtStop`. Scans `idx.stops` filtered to bus operators (KMB / LWB / CTB / NWFB / GMB), returns the closest within `maxMeters` (default 500 m to match `TRANSFER_WALK_LIMIT_M`). Cached by rounded lat/lng so the same station hit twice in one search reuses the result.
- Cross-mode walk: `getPreBus` / `getPostBus` now resolve the rail entry/exit to the nearest bus stop first, then pass that to `findDirect`. The splicer adds the remaining walk from the bus alighting stop to the actual rail station as a tail leg in the `newLegs` array so the journey is physically continuous.

### Changed

- Cache-busters: meta 53 → 54; `planner.js?v=34` → `?v=35`; `planner.css?v=34` → `?v=35`.
- Service-worker CACHE `buseta-v42` → `buseta-v43`.
- `planner.min.js` re-minified (79278 → 81484 bytes, +2206 for the helper + splice legs).

## v52.1 — 2026-10-07

### Fixed

- `findDirect` ride leg was missing `routeMeta` (`planner.js:803`). `strategyOf()` checks `leg.routeMeta.co` to classify a leg as bus vs. rail. Without it the leg is skipped and the journey falls through to the 'mixed' default. One-line fix: add `routeMeta: meta` to the ride leg.
- `buildMixedJourneys` splice assumed `legs[0]` was the walkOut. For pure-rail that holds, but `findMtrRoutes` / `findLrtRoutes` append the cross-mode walks at the END of `rj.legs` so the order is `[ride, walkOut, walkIn]`. The old guard never fired in cross-mode cases and the splice silently fell through. Rewrote the inner loop to locate `walkOut` / `walkIn` by label.

### Changed

- Cache-busters: meta 52 → 53; `planner.js?v=33` → `?v=34`; `planner.css?v=33` → `?v=34`.
- Service-worker CACHE `buseta-v41` → `buseta-v42`.
- `planner.min.js` re-minified (79132 → 79278 bytes).

## v52 — 2026-10-07

### Added

- `buildMixedJourneys()` — for each rail journey (MTR / LRT), tries to find a direct bus from the user's origin to the first ride leg's rail entry station, and/or from the last ride leg's rail exit station to the user's destination. When either exists, the bus legs are spliced in place of the cross-mode walks. The journey has both bus and rail legs so `strategyOf()` correctly buckets it as 'mixed'. Capped at 0–2 extra `findDirect()` calls per search (each pre-warms one new stop's routes, ~250 ms RTT).

### Changed

- Cache-busters: meta 51 → 52; `planner.js?v=32` → `?v=33`; `planner.css?v=32` → `?v=33`.
- Service-worker CACHE `buseta-v40` → `buseta-v41`.
- `planner.min.js` re-minified (76611 → 79132 bytes, +2521 for the new function).

## v51 — 2026-10-07

### Changed

- `TRANSFER_WALK_LIMIT_M`: 350 → 500 m. Some HK bus interchanges (e.g. 大圍站公共運輸交匯處, 黃大仙站) sit up to ~450 m between different operators' stops; the old 350 m cap was silently filtering these out.
- `findTwoTransfer` alight lookahead: 30 → 50 stops. The original 30-stop window cut off long suburban routes mid-journey.
- Deliberately did NOT add on-demand fetching for non-cached R2 routes — cost is unbounded. If loosening isn't enough for the user's specific routes, the next step is option 4 (mixed bus+rail sub-planner) which is a much bigger change.

### Notes

- Cache-busters: meta 50 → 51; `planner.js?v=31` → `?v=32`; `planner.css?v=31` → `?v=32`.
- Service-worker CACHE `buseta-v39` → `buseta-v40`.
- `planner.min.js` re-minified (76283 → 76611 bytes).

## v50 — 2026-10-07

### Fixed

- `findMtrRoutes()` bailed out the moment `origin.stop` wasn't in `idx.mtr`, so the cross-mode block was unreachable for any KMB / CTB / NWFB / GMB origin like MA309 → KT924 (both pure bus). Same bug in `findLrtRoutes()`. With the early-returns gone, both functions now fall through to the existing cross-mode resolver and return valid bus → MTR → bus (or bus → LRT → bus) journeys.

### Changed

- Cache-busters: meta 49 → 50; `planner.js?v=30` → `?v=31`; `planner.css?v=30` → `?v=31`.
- Service-worker CACHE `buseta-v38` → `buseta-v39`.
- `planner.min.js` re-minified (135756 → 76611 bytes raw; 76323 → 76283 shipped).

## v49.1 — 2026-10-07

### Fixed

- v49 comment block said 'the three `<p class="empty">` placeholders' but the home template uses `<div data-bind="savedRoutes|savedStops|recent">` mount points, not `<p class="empty">`. Functionally identical but the wording was inaccurate. No code change.

## v49 — 2026-10-07

### Added

- Onboarding card (`buildOnboardCard()`): a 3-row primer (行程 / 搜尋 / 啟用定位) at the top of the home view with both an inline × and a '知道了' dismiss button. Both write `buseta.onboarded=1` to `localStorage` so returning users never see it again. All visible strings live in the `STRINGS` table (zh-Hant / en / zh-Hans) and are picked up by `applyI18n()`.
- Empty-state CTAs: the three `<p class='empty'>` placeholders under 收藏路線 / 收藏車站 / 最近查過 are replaced by `buildEmptyStateBlock()` which renders the original '未有收藏…' message PLUS a context-aware tip line AND a pill-shaped CTA that takes the user to the right flow.

### Changed

- CSS: `.onboard-card*` and `.empty-state-block*` rules added (~187 LOC). Reuses existing accent / accent-soft / pill tokens.
- i18n: 24 new keys × 3 locales (8 onboard strings + 3 CTA labels + 3 tip lines).
- Cache-busters: meta 47 → 49 (skipped 48); `app.js?v=44` → `?v=45`; `style.css?v=36` → `?v=37`. `planner.js` / `planner.css` not touched.
- Service-worker CACHE `buseta-v37` → `buseta-v38`.

## v48.3 — 2026-10-06

### Fixed

- `stopLatLng` now prefers `idx.mtr` over `idx.stops` when both have the same key. `mtr-stops.json` and `hk-stops.json` disagreed on lat/lng for MOS by 60 m. `idx.mtr.get('MOS').lat` was 22.424979 (built from `mtr-stops.json`), but `stopLatLng('MOS')` returned 22.42491 (via `stopMeta` → `idx.stops` from `hk-stops.json`). Result: `walkLeg(22.424979, 114.231492, 22.42491, 114.23198)` = 601.7 m 'a walk from MOS to MOS' between two MTR coords from different data files. Unifies the MTR router's geometry with its input coordinates.

### Changed

- Cache-busters: `planner.js?v=29` → 30; `planner.css?v=29` → 30.
- `planner.min.js` re-minified (134895 → 76415 bytes, 56.6%).

## v48.2 — 2026-10-06

### Changed

- Cache-busters bumped (`planner.js?v=27` → 28; `planner.css?v=27` → 28) to force CDN refresh; the v48.1 commit's `planner.js` content changes weren't yet live on the GitHub Pages CDN.

## v48.1 — 2026-10-06

### Fixed

- `railRoute` stitched a real walking leg from the nearest rail station to the user's actual destination, but `railRoute`'s internal `walkIn` computed from the rail stop's coords to the user-typed coords in the OPPOSITE direction. Both walks then appeared in the journey: a wrong-direction 51 m leg plus the correct 324 m leg. Fix: when `crossWalkStart` / `crossWalkEnd` is set, pass `railDest` / `railOrigin` with the rail stop's OWN coords (not the user's), so `railRoute`'s internal `walkIn` / `walkOut` resolve to 0.

### Changed

- `planner.min.js` re-minified (134015 → 76253 bytes, 56.9%).

## v48 — 2026-10-06

### Added

- `findNearestMtrStop()` / `findNearestLrtStop()` helpers (~1 m precision cache keyed by rounded coords) returning the nearest rail station(s) to any lat/lng within `DEST_WALK_LIMIT_M`.
- Cross-mode routing: `findMtrRoutes` + `findLrtRoutes` now substitute the nearest rail station when the strict check fails, run the MTR / LRT Dijkstra to that station, and call `appendCrossModeWalk()` to stitch a real walking leg from the station to the actual destination via the v47 `walkLeg()` helper (GraphHopper demo or haversine fallback). Symmetric for both origin and destination.
- The appended walk leg carries real walking geometry so the v44 schematic route-shape canvas draws the actual footpath on the journey card.

### Changed

- `planner.js`: +190/-18 (helpers + findMtrRoutes/findLrtRoutes cross-mode branch + appendCrossModeWalk).
- `planner.min.js` re-minified (133008 → 76323 bytes, 57.4%).
- Cache-busters: meta 47 → 48; `planner.js?v=26` → 27; `planner.css?v=26` → 27.
- Service-worker CACHE `buseta-v36` → `buseta-v37`.

## v47 — 2026-10-05

### Added

- `fetchRealWalkRoute()` queries the public GraphHopper demo at `routing.openstreetmap.de/routed-foot/route/v1/foot/` for a real pedestrian route — duration, distance, and a GeoJSON LineString. Cached in `_walkRouteCache` keyed by rounded coords (~1 m precision) so back-to-back searches don't hammer the demo. On any failure we fall back to `walkMinutes()` so the planner still works offline.
- `walkLeg()` wraps `fetchRealWalkRoute` + the haversine fallback so every router (`findDirect`, `findOneTransfer`, `findTwoTransfer`, `railRoute`) is one line. Walk legs now carry `geometry` and `routed` so the canvas can draw the real footpath.
- `buildJourneyCanvas` draws the routed walk as a dashed polyline through the geometry coords (downsampled to ~32 segments for long paths). The dashed corner-anchor fallback from v44 still fires for unrouted legs.
- Card meta row now reads '步行 0.3 km · 約 4 分鐘' instead of just distance. Legs strip shows walk minutes alongside distance.
- New i18n key `plannerWalkMinPrefix` (約 / ~ / 约) localised for all three locales.

### Changed

- `planner.css .planner-canvas-walk-routed`: heavier accent-coloured dashed stroke (`var(--accent)` at 1.8 / 0.85 opacity).
- Cache-busters: meta 46 → 47; `planner.js?v=22` → 23; `planner.css?v=22` → 23.
- Service-worker CACHE `buseta-v35` → `buseta-v36`.
- `planner.min.js` re-minified (124879 → 71577 bytes, 57.3%); `planner.min.css` re-minified (17986 → 13237 bytes, 73.6%).

## v46 — 2026-10-05

### Fixed

- The user report 'always 暫時搵唔到合適嘅路線' traced back to the planner's recent-row click handler setting `_selected.origin` / `_selected.dest` without writing `field.dataset.stopId`. `runSearch()` prefers the latter, so the stale value left over from the initial-mount prefill won every time and the search ran for the wrong stops.

### Changed

- Cache-busters: meta 45 → 46; `planner.js?v=21` → `?v=22`; `planner.css?v=21` → `?v=22`.
- Service-worker CACHE `buseta-v34` → `buseta-v35`.
- `planner.min.js` re-minified (115291 → 66909 bytes, 58.0%).

## v45.2 — 2026-10-05

### Changed

- SW CACHE bumped `buseta-v33` → `buseta-v34` to flush any cached broken `planner.js`.

## v45.1 — 2026-10-05

### Changed

- Cache-busters bumped `?v=20` → `?v=21` on `planner.js`/`planner.css` in `index.html` to dodge the SW-cached broken file.

## v45 — 2026-10-05

### Added

- `assets/lrt-stops.json` — 67 stops, 3.8 KB. Curated lat/lng table for every LRT stop, sourced from Wikipedia geo-coordinates.

### Changed

- `app.js`: `API.LRT_STOPS = 'assets/lrt-stops.json?v=1'` added to the URL map. `buildIndex()` now `Promise.all`s `fetchJSON(API.LRT_STOPS)` alongside the other stops feeds. After the existing per-stop loop in the LRT section, the new overlay merges lat/lng from the curated table onto each entry in `lrt.stops`. `INDEX_SCHEMA_VERSION` bumped 4 → 5.
- `planner.js`: `buildLrtGraph()` reads `lat` / `lng` from `idx.lrt.stops`. `railRoute()`'s v42 haversine call picks them up automatically.
- Cache-busters: `index.html` meta 44 → 45; `app.js?v=44` → `?v=45`; `planner.js?v=19` → `?v=20`; `planner.css?v=19` → `?v=20`.
- Service-worker CACHE `buseta-v32` → `buseta-v33`.
- `planner.min.js` re-minified (114302 → 66747 bytes, 58.4%).

## v44 — 2026-10-05

### Added

- `planner.js`: `buildJourneyCanvas()` now renders the walk-out (first leg when `kind === 'walk' && from === 'origin'`) and walk-in (last leg when `kind === 'walk' && to === 'dest'`) as thin dashed lines from a canvas-edge anchor to the first / last ride dot.

### Changed

- `planner.css`: new `.planner-canvas-walk` class with `stroke-dasharray` "3 2" + 0.6 opacity.
- Cache-busters: meta 43 → 44; `app.js?v=43` → `?v=44`; `planner.js?v=18` → `?v=19`; `planner.css?v=18` → `?v=19`.
- Service-worker CACHE `buseta-v31` → `buseta-v32`.

## v43 — 2026-10-05

### Changed

- `planner.js`: `search()` now detects when both origin and dest are MTR / LRT stations and replaces the three bus sub-planners with empty arrays. For pure-rail queries this drops cold-cache wall time from ~6 s to <100 ms.
- Cache-busters: meta 42 → 43; `app.js?v=42` → `?v=43`; `planner.js?v=17` → `?v=18`; `planner.css?v=17` → `?v=18`.
- Service-worker CACHE `buseta-v30` → `buseta-v31`.

## v42 — 2026-10-05

### Fixed

- `planner.js`: `railRoute()` now computes meters via haversine between consecutive stations so MTR / LRT ride legs report real km instead of 0. The merge loop that combines consecutive single-station rides on the same line sums meters across legs.

### Added

- `planner.js`: `buildJourneyCanvas()` draws an inline route-shape canvas on every journey card. One `<line>` per ride leg coloured by operator + origin (green) and destination (red) dots.
- `planner.js`: `buildSummary()` now surfaces `X.X km` beside the best-journey's minutes.
- `planner.js`: extended `console.log` line reports `cov=N empty=0|1`.
- `planner.css`: new `.planner-card-canvas` + `.planner-canvas-line` + `.planner-canvas-dot` classes.

### Changed

- Cache-busters: meta 41 → 42; `app.js?v=41` → `?v=42`; `planner.js?v=16` → `?v=17`; `planner.css?v=16` → `?v=17`.
- Service-worker CACHE `buseta-v29` → `buseta-v30`.
- `planner.min.js` re-minified (65434 B, 58.7% of source); `planner.min.css` re-minified (12964 B, 74.8%).

## v41 — 2026-10-05

### Added

- `planner.js`: `search()` now captures three parallel feeds so each strategy is genuinely different routing rather than a re-ranking of one merged bucket (`busDirect` / `busOneTransfer` / `busTwoTransfer`; `railDirect` / `railOneTransfer`; legacy merged `direct` / `oneTransfer` / `twoTransfer`). New `STRATEGY_LIMIT = 2` tunable. New `strategyOf(j)` helper classifies each journey by ride-leg mode composition (bus / rail / mixed / pure-walk). `result.strategies = { bus, rail, mixed }` each = `{ journeys, best }`.

### Changed

- `planner.js`: `renderPlanner()` swaps the three direct/1-hop/2-hop sections for three coloured STRATEGY_LABELS sections (Bus → accent orange, Rail → accent-2 red, Mixed → muted indigo). Strategy tag badge uses `.planner-strategy-tag` (orange/red/indigo gradients).
- `planner.js`: `patchPlannerStrings()` extended with 6 new keys × 3 locales = 18 new string entries. Zero edits to `app.js`.
- `planner.css`: `.planner-strategy-tag` + `.is-bus` / `.is-rail` / `.is-mixed` (~20 LOC).
- Cache-busters: meta 40 → 41; `app.js?v=40` → `?v=41`; `planner.js?v=15` → `?v=16`; `planner.css?v=15` → `?v=16`.
- Service-worker CACHE `buseta-v28` → `buseta-v29`.

## v40 — 2026-10-05

### Added

- TD XML disruption feed integration. `app.js`'s `fetchDisruptions()` now does:
  - `fetchText(TD_DISRUPTIONS_URL)` (cached by the SW with a 24h TTL + `If-Modified-Since`).
  - `DOMParser` walks every `<Notice>`. `parsererror` element → `[]`. Notices with `StartEffectiveDate` older than today-30d are dropped.
  - Per-notice route extraction (CN + EN regex matchers).
  - Operator classification (title text): 九巴/KMB → KMB; 龍運/LWB; 城巴/CTB; 新巴/NWFB; *專線小巴/GMB; 港鐵巴士/MTR; 輕鐵/LRT.
  - Severity heuristic (title + content body): severe > warn > info > default-info.
- SW new bucket `TD_DISRUPTION_CACHE = 'buseta-td-disruptions-v1'`. 24h freshness, `If-Modified-Since` revalidate, dedicated cross-origin fetch branch.

### Changed

- Cache-busters: `app.js` meta 39 → 40, `?v=39` → `?v=40`. `style.css` unchanged.
- Service-worker CACHE `buseta-v27` → `buseta-v28`.

## v39 — 2026-10-05

### Changed

- `app.js`: `fetchDisruptions()` short-circuits to `Promise.resolve([])`. No network fetch of `assets/disruptions.json`. Banner DOM is no longer built.

## v38 — 2026-10-05

### Added

- `app.js`: `isDisruptionExpired(it)` helper. Returns true when `it.until` (YYYY-MM-DD, HK end-of-day) is strictly before today in HK time. Items without an `until` field are treated as indefinite and never expire.
- SW: SWR-style 6h freshness window for `assets/disruptions.json`.

## v37 — 2026-10-05

### Added

- Off-peak routes: `findTerminusRoutesForStop(stopNameTc)` walks the route index and returns KMB / LWB / CTB / NWFB routes whose `origTc` OR `destTc` matches exactly. Live-ETA cards are unaffected — the terminus scan only inserts entries that aren't already in `routeMap`.

## v36 — 2026-10-05

### Fixed

- When a user navigated to `#/stop/MA973` (the operator-facing code on the bus stop sign), the live panel always fell through to "暫無到站時間" because KMB upstream `/stop-eta/{id}` only accepts the internal 16-hex form. Operator codes 404 with empty data.

### Changed

- `stateRef.internalStopId` carries the resolved 16-hex through to all downstream fetches.
- `refreshBusStopView`, `buildStopTabs`, `state._refreshStop` apply the same resolution to cache keys + render calls.

## v35 — 2026-10-05

### Added

- Off-peak route cards: `buildNoEtaCard(co, route, destTc, destEn, onSchedule)` renders a dimmed card for routes that serve the stop but have no live ETA. Schedule-tab CTA included.
- CTB parity: live CTB fetch switched from no-op to `fetchCitybusBatchStopEta(stopId)`.

## v34 — 2026-10-05

### Added

- Friendly-fallback for unresolvable stops: `app.js` `renderBusStopView` seed falls back to `t_str('stopUnknownName')` when both the local index AND the `kmbOperatorId` reverse map miss. The raw ID is rendered as a small muted sub-line via `buildStopHeader`.
- `pruneRecentStops()` drops every `state.recent` row whose `stop` field fails any local lookup.

## v33 — 2026-10-05

### Changed

- Cache-buster `?v=32` → `?v=33` + SW `buseta-v21` → `buseta-v22`. Forces a fresh network fetch of `app.js`, bypassing the SW cache for the buggy URL.

## Earlier versions

Versions v1–v32 (pre-2026-10-05) are not enumerated here. See `git log` for full history. The project's first public commit was 2026-10-02 and v33 was the first entry with cache-buster / SW versioning discipline.