# Performance budget — Phase 43 lazy-load strategy

> BusETA HK ships as a PWA without a build step. The cache-buster
> discipline in [docs/cache-strategy.md](cache-strategy.md) handles the
> "make sure stale assets don't keep running" half of the story. This
> doc covers the other half — keeping the first-paint payload small
> enough that a cold-cache boot paints the splash + first view in under
> one second on a typical HK mobile connection.

## Cold-cache first-paint budget

Measured against `enhance/phase43-perf-lazy-load` (Phase 43):

| Asset                  | Size (uncompressed)   | Notes                                                          |
| ---------------------- | --------------------- | -------------------------------------------------------------- |
| `index.html`           | ~75 KB                | Inlined critical CSS, in-page release notes                    |
| `app.js`               | ~75 KB                | Main app shell (deferred)                                      |
| `style.css`            | ~117 KB               | Main stylesheet (link rel=stylesheet, blocking on first paint) |
| `assets/hk-stops.json` | ~190 KB (~50 KB gzip) | **Phase 43 — deferred; no longer in the first-paint path**     |

Pre-Phase 43 the SW's `ASSET_CACHE` for `hk-stops.json` worked fine for
return visits, but on a true cold first-ever load `loadIndex()`'s
`Promise.all` included the file and added ~190 KB (uncompressed) to the
critical-path payload. On a flaky connection that round-trip ate into
the splash-paint-to-interactive budget.

## Trigger boundary

`assets/hk-stops.json` is fetched only when a feature actually needs
its coordinates. Trigger points (implemented in
[app.js](../app.js) + [src/utils/stops-cache.js](../src/utils/stops-cache.js)):

1. **Search typeahead fires for the first time** —
   `renderResults()` calls `ensureHkStopsLoaded()` on the first call
   with a non-empty query. Repeat keystrokes share the in-flight
   promise (helper-module de-dup). On a fast connection the catalogue
   lands before the user has finished typing their first query.

2. **Location permission granted** —
   `requestLocation()`'s success callback fires `ensureHkStopsLoaded()`
   and re-renders via `onMerged`. The home view's nearest-stop pill
   - nearby sections populate once the merge completes.

3. **`/route/...` or `/stop/...` direct-nav** —
   `onHashChange()` schedules `ensureHkStopsLoaded()` and re-renders
   the detail view via `onMerged` so the inline stops get full
   GMB / NLB / MTR name + coord coverage.

4. **Search / home "nearby" sections** —
   `populateNearbyInto(view)` shows a "Loading nearby stops…" hint in
   `.muted` until the catalogue lands. MTR stations render immediately
   because they read `state.index.mtr` (already eager from
   `mtr-stops.json`).

A first-paint home view with no location grant, no search keystroke
and no detail navigation never touches the network. The splash + home
render with just `app.js + style.css` lands in well under a second on a
typical HK connection.

## Caching strategy

Two cache layers for `hk-stops.json` after Phase 43:

1. **Service worker `ASSET_CACHE` bucket** — was added in Phase 3,
   unchanged in Phase 43. After the lazy-load fires once, subsequent
   reloads get the cached body back via `cache: 'force-cache'`. SWR
   pattern refreshes in the background.
2. **localStorage mirror** — Phase 43 addition. Key
   `buseta.stops.v1` (data) + `buseta.stops.ts.v1` (timestamp). TTL
   mirrors the existing `ROUTE_STOPS_MAX_AGE_MS` of 7 days. On reload,
   the helper reads the mirror synchronously and avoids the network
   round-trip entirely if the entry is fresh.

The localStorage mirror is what makes the lazy-load "free" on repeat
visits: the cold-cache network hit happens at most once per device
per week, not on every page load.

## Acceptance criteria

- `npm run check` exits 0.
- All `STRINGS` keys present in all three locales (verified by
  `tests/unit/i18n-parity.test.js`).
- `assets/hk-stops.json` is **not** fetched on home-view mount
  (verified by code inspection: `renderHome()` does not call
  `ensureHkStopsLoaded()` directly; it only fires via
  `populateNearbyInto`, which is gated on `state.userLoc`).
- Stops **are** fetched when the user taps nearby / uses location /
  types a search / navigates to a route or stop view.
- All existing tests still pass + the new
  `tests/unit/stops-cache.test.js` suite covers the helper.

## Future work

- Cold-cache first-paint measurement: add a PWA-Lighthouse gate to
  the CI workflow that fails the build if `request count` on the
  home view goes above a small N. Today's budget is N=0 for
  `hk-stops.json` and ~6 for the index Promise.all.
- Edge-case review: when a tab is restored from BFCache after the
  helper-module instance has been thrown away. Currently `cached` is
  module-scoped, so it survives the tab restoration but the
  `state._hkStopsMerged` flag (page-scoped) is lost — the merge
  re-fires and the localStorage mirror absorbs the cost. Logged
  for a future cycle if BFCache becomes a measurable pain point.
