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
- **`CHANGELOG.md` (this file)** (PR #21): backfilled in Keep a Changelog
  1.1.0 format. Linked from `README.md` so contributors can find the per-PR
  history.
- **Cache-buster consistency test** (PR #22): `tests/unit/cache-buster.test.js`
  scrapes the six live cache-buster values from `index.html` + `sw.js`
  via plain regex and enforces six invariants (every value is a positive
  integer; `meta >= max(asset ?v=)`; `sw.js CACHE >= max(asset ?v=)`;
  `app.js?v >= style.css?v`; `planner.js?v >= planner.css?v`; all values
  < 9999). 6 cases.
- **`docs/cache-strategy.md`** (PR #23): the source-of-truth doc the
  cache-buster test cites. Documents the six knobs, when each is bumped,
  the six invariants, two worked examples (Phase 16 + Phase 19), how to
  add a new asset, and what the strategy does _not_ cover. 134 lines.
- **ESLint 9 flat config** (PR #24): `eslint.config.mjs` (128 lines, three
  scoped blocks for `src/utils/` + `tests/` + `scripts/`). Pinned
  `@eslint/js` + `globals` as direct devDependencies. Previously `npm run
lint` errored with "ESLint couldn't find an eslint.config.* file".
  The legacy monolith (`app.js`, `planner.js`, `sw.js`) is explicitly
  excluded with a comment explaining why.
- **`.editorconfig`** (PR #24): UTF-8, LF, trim trailing whitespace,
  final newline, 2-space indent. Makefiles use tabs, Python uses
  4 spaces.
- **`scripts/check-cache-buster.js`** (PR #25): Node CLI mirror of
  `tests/unit/cache-buster.test.js`. Same regexes, same invariants,
  same exit codes. Useful for pre-commit hooks and CI runners without
  Vitest. Mirrors the pattern of `scripts/check-i18n.js` (Phase 9).
- **`npm run check` aggregator** (PR #25): runs
  `lint + lint:i18n + lint:cache-buster + format:check + test` end-to-end
  in ~45s. `npm run check:fix` is the auto-fix variant
  (`lint:fix + format`). All 189 tests + all 6 cache-buster invariants +
  ESLint + Prettier pass in one command.
- **GitHub Actions CI workflow** (PR #26): `.github/workflows/ci.yml`
  calls `npm run check` on every PR to `main`, every push to `main`,
  and on manual dispatch. `actions/checkout@v4` + `actions/setup-node@v4`
  (Node 20, npm cache) + `npm ci --no-audit --no-fund` + `npm run check`.
  Permissions: `contents: read` only.

### Changed

- **Cache-buster discipline** (PR #1 onwards): every JS / CSS-touching commit
  bumps `<meta name="buseta-version">`, the `?v=` query strings on script /
  stylesheet tags, and `sw.js const CACHE` in lock-step. Documented inline in
  each PR's "Cache-buster bumps" table.
- **`globalThis.busetaUtils` pattern** (PR #4 onwards): every `src/utils/`
  module uses `export …` for Vitest + `globalThis.busetaUtils = Object.assign(...)`
  for in-browser classic-script use. Idempotent on multiple loads.
- **`assets/*.json` excluded from Prettier** (PR #25): added to
  `.prettierignore` with a comment explaining why. Mirrors ESLint's
  existing `assets/**` ignore. Hand-curated reference data with
  intentional formatting — reformatting would obscure content changes
  in PR diffs.

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
- **Stale `TODO(v38)` comment in `app.js`** (PR #22): replaced by a `NOTE`
  pointing at the v53 / Phase 11 + 12 implementation (the helper now
  lives in `src/utils/routes-by-stop.js` and is populated by
  `prefetchRouteStops()`). The function `findTerminusRoutesForStop` is
  still legitimately used as the `terminusMatches` half of the merged
  lookup — this is purely a comment cleanup.

[Unreleased]: https://github.com/rollroyces/buseta-hk/compare/v53...HEAD
