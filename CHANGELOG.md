# Changelog

All notable changes to BusETA HK are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Foundation & community health** (PR #1): CONTRIBUTING.md, CHANGELOG.md,
  CODE_OF_CONDUCT.md, SUPPORT.md, SECURITY.md, ARCHITECTURE.md, issue templates
  (bug report + feature request), pull request template, Dependabot config,
  OpenSSF Scorecard workflow, Vitest + npm script wiring (test, test:run,
  lint:i18n). 183 unit tests live under `tests/unit/` and run via
  `npm test`.
- **Codebase format pass** (PR #2): Prettier-formatted `app.js`, `planner.js`,
  `index.html`, `sw.js`, `style.css`, `planner.css`. Added `.prettierrc.json`
  and `.prettierignore`.
- **`src/utils/geo.js`** (PR #3): `haversineKm(a, b)` + `kmToMeters(km)`
  helpers, 9 Vitest cases.
- **`src/utils/time.js`** (PR #3): `formatLocalHM(date)`, `nowInTz(tz)`,
  `minutesUntil(iso, ref)`, 6 cases.
- **`src/utils/disruptions.js`** (PR #3): `summariseDisruptions(list)` +
  `getActiveDisruption(list, routeKey)`, 7 cases.
- **Modularization** (PR #4): `app.js` and `planner.js` consume helpers via
  `globalThis.busetaUtils`. Fixed BUS_KMH drift bug surfaced during refactor.
- **`src/utils/network.js`** (PR #5): `fetchJSON(url, opts)` + `fetchText(url,
opts)` with timeout + retry. 7 cases.
- **`src/utils/operators.js`** (PR #5): `classifyKmbOp(suffix)` + `opCoKey(key,
op)` covering 27 KMB / LWB operator suffixes. 12 cases.
- **`src/utils/text.js`** (PR #6): `stripKmbOpSuffix(name)` + `pickName(en, zh)`
  - `parseCsvLine(line)` for CSV parsing. 31 cases including edge cases for
    empty / quoted / unicode text.
- **Lighthouse CI** (PR #7): `.lighthouserc.json` with perf ≥ 0.7, a11y ≥ 0.9,
  best-practices ≥ 0.85, seo ≥ 0.8. `.github/workflows/lighthouse.yml` uses
  `treosh/lighthouse-ci-action@v12` on push to main.
- **`src/utils/date.js`** (PR #8): `parseHKEtaDate(s)` — robust parser for the
  KMB `ETA_DATE` field that accepts `'2024-01-15 23:30'` and `Date` objects.
  14 cases.
- **`src/utils/disruption-classify.js`** (PR #8): `classifyDisruption(message)`
  returns one of `suspension | detour | special | info`. 22 cases.
- **`stripTags(html)`** added to `src/utils/text.js` (PR #8): strips
  `<...>` tags while leaving the text intact, used when ingesting
  disruption messages.
- **PWA install + favicon + apple-touch-icon PNGs** (PR #9): `scripts/build-icons.py`
  uses Pillow to generate 192×192, 512×512, 180×180, 16×16 and 32×32 PNGs from
  `assets/icon.svg`. `manifest.json` and `index.html` favicon links updated.
- **`zh-Hans` STRINGS parity** (PR #10): 11 missing Traditional-only keys
  filled in for Simplified Chinese. `tests/unit/i18n-parity.test.js` +
  `scripts/check-i18n.js` enforce every key exists in all three lang blocks
  (`npm run lint:i18n`).
- **`src/utils/routes-by-stop.js`** (PR #12): `buildRoutesByStopMap(routes)` +
  `findRoutesServingStop(map, stopId)`. 16 cases. Integrated into
  `refreshBusStopView` with `state.routesByStop` + `terminusMatches` merged
  lookup.
- **`src/utils/concurrency.js`** (PR #13): `mapWithCap(items, cap, worker)`
  bound-concurrency runner. 10 cases. `prefetchRouteStops()` in `app.js`
  fires after `loadIndex()` with cap=8, populates
  `state.routeStopsByRoute` + `state.routesByStop`. `fetchCtbRouteStop` helper
  added.
- **Planner input a11y + view-focus + `<noscript>`** (PR #14): planner input
  has `id` + `aria-label`; view-change focus management routes through
  `<main tabindex="-1">`; `<noscript>` fallback banner shown when JS is off.
- **`localStorage` persistence for prefetched route-stops** (PR #15):
  `STORAGE_KEYS.ROUTE_STOPS` + `STORAGE_KEYS.ROUTE_STOPS_TS` with a 7-day TTL,
  debounced save, `pagehide` final flush.
- **`src/utils/focus-trap.js`** (PR #16): `getFocusableElements(root)` +
  `createFocusTrap(modalEl, opts)` returning `{ activate, deactivate }`. 20
  jsdom tests. Applied to the share / QR modal. Brings `jsdom` into
  `devDependencies`.
- **`src/utils/stop-view-summary.js`** (PR #17): `summariseSoon(routes)` +
  `buildStopViewSummary(summary, t_str)` with `SUMMARY_WINDOW_MIN = 30`. 14
  cases. `aria-live="polite"` region rendered under the `<h2>` in
  `refreshBusStopView`. `.sr-only` CSS rule added next to the existing
  `.skip-link`.
- **`aria-current="page"` + global `:focus-visible`** (PR #18): active
  bottom-nav button gets `aria-current="page"` (cleared on inactive items);
  `:where(a, button, input, select, textarea, [tabindex]):focus-visible { outline:
2px solid var(--accent, #0EA5E9); outline-offset: 2px; }` rings every
  interactive element on keyboard focus without affecting mouse clicks.
- **Dedicated `ariaSummary(count, mins)` translation** (PR #19): replaces the
  `${etaCount(count)}, ${soonest} ${minShort}` composition in the stop-view
  live region. Chinese leads with the duration, English uses "arriving in the
  next N minutes".

### Changed

- **Cache-buster discipline** (PR #1 onwards): every JS / CSS-touching commit
  bumps `<meta name="buseta-version">`, the `?v=` query strings on script /
  stylesheet tags, and `sw.js const CACHE` in lock-step. Documented inline in
  each PR's "Cache-buster bumps" table.
- **`globalThis.busetaUtils` pattern** (PR #4 onwards): every `src/utils/`
  module uses `export …` for Vitest + `globalThis.busetaUtils = Object.assign(...)`
  for in-browser classic-script use. Idempotent on multiple loads.

### Fixed

- **BUS_KMH drift** (PR #4): `BUS_KMH` was previously declared once in
  `app.js` and re-declared elsewhere — refactor surfaces the duplicate and
  the test catches it.
- **Stilted zh-Hant phrasing** (PR #19): `仲有 3 班, 5 分` reads as "still have
  3 buses, 5 min" — replaced by `${count} 班車喺 ${mins} 分鐘內到站`.
- **Modal focus escape** (PR #16): Tab previously escaped the share / QR modal
  to the page behind; focus trap now cycles within the modal and restores
  focus to the trigger on close.

### Removed

- **Dead `walkMinutesTo`** (PR #11): unused function in `planner.js` removed
  in a dedicated cleanup. Parity test extended to scan planner.js's
  `ensure('lang', 'key', …)` calls (3 new cases).
- **Local `mapWithCap` in `planner.js`** (PR #20): four callsites now route
  through `busetaUtils.mapWithCap`. Single source of truth for bound-
  concurrency futures (cancellation, AbortSignal).

[Unreleased]: https://github.com/rollroyces/buseta-hk/compare/v53...HEAD
