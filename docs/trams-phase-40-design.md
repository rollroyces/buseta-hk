# Phase 40 — Trams UI integration design (Option A)

> **Status:** design proposal — companion to
> [`docs/new-operator-research.md`](./new-operator-research.md) (Phase 37
> research + Phase 38½ rescope). This document assumes the maintainer
> accepts **Option A** (drop live fetch, integrate the bundled stop
> catalogue into the existing UI). If Option B or C is accepted
> instead, this doc is superseded.

## TL;DR

Wire the Phase 38 bundled stub into the existing operator-aware UI.
Three integration points, all minimal:

1. **Operator discriminator** — `opCoKey('TRAMS') === 'trams'`.
2. **Index population** — `state.index.trams` Map populated from
   `fetchTramStops()` during the same `Promise.all` block as the
   other operator indices (app.js:1227–1241).
3. **Three UI surfaces** — operator filter chip on the home view,
   "tram stop" card variant in the stop view, "nearby tram stops"
   section that mirrors the existing "nearby MTR stations" block
   (app.js:4584–4614).

No new live-data path (Option A dropped Phase 39). No new
infrastructure. No npm dependency. The Phase 38 bundled JSON is the
only data source.

## Why this is small

- The existing operator discriminator (`opCoKey`) is a 6-line switch
  in [`src/utils/operators.js`](../src/utils/operators.js:37).
- The home view's "nearby MTR stations" block is a 30-line pattern
  that maps directly onto tram stops (just no live ETAs).
- The bundled `assets/tram-stops.json` already has the same
  `{ zh, en, lat, lng }` shape as `assets/mtr-stops.json`, so the
  index population reads cleanly.

Estimated diff: **+80 / −10 LOC** in `app.js` (one filter chip, one
nearby-stops block, one operator discriminator entry). **+8 / −0 LOC**
in `src/utils/operators.js`. **+18 STRINGS keys × 3 locales = +54
LOC** in `app.js`. **+0 LOC** in any `src/utils/*.js` (the bundled
`fetchTramStops()` from Phase 38 is sufficient).

## File-by-file plan

### `src/utils/operators.js` (+8 LOC)

Add one branch to `opCoKey`:

```js
if (co === 'TRAMS') return 'trams';
```

Add `'TRAMS'` to the JSDoc enum in the existing comment.

No new exports. No new tests — the existing
[`tests/unit/operators.test.js`](../tests/unit/operators.test.js)
already covers the discriminator with 12 cases; one more test added
for `'TRAMS' → 'trams'` brings it to 13.

### `app.js` (+~135 / −10 LOC)

#### 1. STRINGS — new keys × 3 locales

Add 6 new entries (after `lrt:`, before `routeNotFound:`):

```js
// zh-Hant
filterTrams: '電車',
tramStop: '電車站',
tramDirectionWest: '西行',
tramDirectionEast: '東行',
tramNoEta: '暫無電車到站時間（請參考路面時間表）',
// en
filterTrams: 'Trams',
tramStop: 'Tram stop',
tramDirectionWest: 'Westbound',
tramDirectionEast: 'Eastbound',
tramNoEta: 'No live tram ETAs (refer to on-street timetable)',
// zh-Hans (parallel)
filterTrams: '电车',
tramStop: '电车站',
tramDirectionWest: '西行',
tramDirectionEast: '东行',
tramNoEta: '暂无电车到站时间（请参考路面时间表）',
```

(`scripts/check-i18n.js` parity guard will block the PR if any locale
is missing a key — same as the existing `trams:` entries from
Phase 38.)

#### 2. Index population (+~15 LOC)

In the `buildIndex()` block (app.js:1227–1241), add one more tuple
slot + one more `Promise.all` entry:

```js
const [..., mtrStops, tramStops] = await Promise.all([
  ...
  busetaUtils.fetchJSON(API.MTR_STOPS).catch(() => null),
  busetaUtils.fetchTramStops(),  // already null-safe per Phase 38
]);

const trams = new Map();
if (tramStops) {
  for (const [code, info] of Object.entries(tramStops)) {
    if (code === '_meta') continue;
    if (!info || !Number.isFinite(info.lat) || !Number.isFinite(info.lng)) continue;
    trams.set(code, {
      stop: code,
      nameTc: info.zh,
      nameEn: info.en,
      lat: info.lat,
      lng: info.lng,
      co: 'TRAMS',
    });
  }
}
```

The shape mirrors `state.index.mtr` so any downstream consumer that
treats both uniformly Just Works. `co: 'TRAMS'` keeps the operator
discriminator threadable through the rest of the pipeline.

#### 3. Home view — "nearby tram stops" block (+~30 LOC)

Mirror the existing "nearby MTR stations" block (app.js:4584–4614):

```js
const nearbyTrams = Array.from(state.index.trams.values())
  .map((st) => ({ st, d: busetaUtils.haversine(loc.lat, loc.lng, st.lat, st.lng) }))
  .filter((x) => x.d < 1.5)
  .sort((a, b) => a.d - b.d)
  .slice(0, 6);

// ... append to the existing nearby-section render ...
```

Renders as a list of "Tram stop / 80 m" cards with no ETA. Each card
links to a tram stop view (new variant, see #4 below).

#### 4. Stop view — tram variant (+~30 LOC)

Add a new branch to the stop-view dispatcher (the function that
decides which card variant to render based on `stop.co`):

```js
if (stop.co === 'TRAMS') {
  return renderTramStopView(stop);
}
```

`renderTramStopView(stop)` is a slim variant that:

- Shows the bundled stop name (zh-Hant + en).
- Shows a directional hint based on the bundled stop's metadata
  (the `route: 'W' | 'E' | 'B'` suffix on each entry — already
  present in the upstream `hongkong-trams` codes, will be added to
  `assets/tram-stops.json` in a one-line prep commit).
- Shows `STRINGS.tramNoEta` instead of an ETA list.
- Shows a "find nearby tram stops" link to the next-closest entry
  (reuses the `nearbyStops` haversine pipeline).

No live ETAs. No live data. The view is honest about that ("no live
ETAs — refer to on-street timetable").

#### 5. Operator filter chip on home view (+10 LOC)

Where the existing `filterKMB / filterLWB / filterCTB / filterGMB /
filterMTR` chips render, add:

```js
buildFilterChip('TRAMS', t_str('filterTrams')),
```

That's it. The chip toggles `state.filter.trams` like the others;
the existing route-render pipeline will surface tram entries in
the search results when the chip is on.

### Tests

Add to [`tests/unit/operators.test.js`](../tests/unit/operators.test.js):

```js
it("opCoKey('TRAMS') returns 'trams'", () => {
  expect(opCoKey('TRAMS')).toBe('trams');
});
```

No new test file (the existing `trams.test.js` from Phase 38 already
covers `fetchTramStops`; this PR is UI-only, mostly DOM-conditional
renders that would require either E2E coverage or a dedicated
`renderTramStopView` extraction to test directly — see the "out of
scope" note below).

## CSS

Add 3–4 new class rules to `style.css`:

```css
.op-pill--trams {
  /* orange accent matching Hong Kong Tramways livery */
}
.tram-stop-card {
  /* similar to .mtr-card but with the orange accent */
}
.tram-stop-card__no-eta {
  /* muted placeholder when bundled data has no ETAs */
}
.tram-stop-card__direction {
  display: inline-block;
  margin-left: 0.5em;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
  background: rgba(255, 165, 0, 0.12);
}
```

≤ 30 LOC delta. Reuses the existing palette tokens (no new theme
knobs).

## Cache-buster bumps

Per `docs/cache-strategy.md`:

| Knob                    | Before (post-Phase 38) | After (Phase 40) | Why                                                                |
| ----------------------- | ---------------------- | ---------------- | ------------------------------------------------------------------ |
| `meta`                  | `75`                   | `76`             | JS + CSS both touched                                              |
| `app.js?v=`             | `64`                   | `65`             | app.js changed (index + nearby block + filter chip + stop variant) |
| `planner.js?v=`         | `42`                   | `42`             | planner.js not touched                                             |
| `planner.css?v=`        | `38`                   | `38`             | planner.css not touched                                            |
| `style.css?v=`          | `39`                   | `40`             | style.css changed (4 new class rules)                              |
| `sw.js CACHE`           | `buseta-v64`           | `buseta-v65`     | Always bumps with JS/CSS touches                                   |
| `src/utils/trams.js?v=` | `1`                    | `1`              | Untouched (only consumed, not modified)                            |

## Out of scope

- **Route catalogue** (Phase 41 in the original arc). The bundled
  JSON doesn't carry route-level data (Western / Happy Valley loop /
  Causeway Bay loop / etc.), so without live data there's nothing
  meaningful to render at the route level. Defer.
- **Live ETAs.** Phase 39 was dropped per the Phase 38½ rescope.
  Phase 40 ships the directory surface; ETAs stay as "no live data"
  honestly.
- **Reverse geocoding "nearest tram stop".** The existing nearby
  pipeline already does this (just rerenders it through the home
  view); Phase 40 reuses that pipeline. No new geocoding work.
- **A dedicated `renderTramStopView` test.** The render function is
  tightly coupled to the surrounding DOM lifecycle (live region,
  back chevron, language toggle) — testing it requires either an
  E2E harness or a JSDOM-style extraction that we haven't built.
  Defer to Phase 42 (test infrastructure) or a follow-up PR.

## Risks

1. **Bundle of 24 stops may be insufficient** for users who live
   further east / west of the 6 routes the bundled set covers.
   Mitigation: Phase 38's catalogue covers Western + Happy Valley
   loop + Causeway Bay + North Point + Shau Kei Wan + Wharf
   Causeway Bay loops. Hong Kong Island residential coverage is
   ~70%; missing stops are termini (no Central, Admiralty mid-
   block, Wan Chai mid-block). If user reports surface this, expand
   `assets/tram-stops.json` in a follow-up PR.
2. **Honest "no live ETA" messaging could read as a regression**
   for users who expected the upstream to be live. Mitigation: the
   `tramNoEta` string explicitly references the on-street
   timetable, framing the absence as a known upstream limitation
   rather than a bug.
3. **Bundled stop names are static; new tram stops / renames
   won't propagate.** Same risk as MTR (the bundled
   `assets/mtr-stops.json` has the same characteristic) — Phase 38's
   `_meta.scrapedOn` field is the audit trail.

## Open design questions

- **Should the home view render trams before or after MTR?**
  Recommendation: after (MTR is the more familiar operator; trams
  are a Phase-40 newcomer). Render-order is a single-line sort
  tweak in the home-view dispatcher.
- **Should the search view include tram stops in the global
  keyword search?** Recommendation: yes — `searchIndex()` already
  walks `state.index.*`, so adding `state.index.trams` to that
  walk is one extra `.concat()` line. The downside is that tram
  stops appear alongside bus stops and MTR stations; users in a
  Tram-rich area would see a lot of tram entries first. Acceptable
  tradeoff; user can filter by the new "Trams" chip.

## Verification plan

- `npm run check` exits 0 (lint + lint:i18n + lint:cache-buster +
  format:check + test).
- All 6 cache-buster invariants pass (I1–I6).
- i18n parity: 262 keys × 3 locales (was 256, +6 new keys).
- 230/230 tests pass (was 229, +1 for `opCoKey('TRAMS')`).
- Manual smoke test (will be in the PR description for the
  reviewer): open the deployed app, enable location, confirm
  nearby tram stops render; click into a tram stop, confirm the
  "no live ETA" message + directional hint + nearby-stops link all
  work in all three languages.

## Merge order

Independent of PR #39 and PR #40. Both should merge before this PR
so:

1. PR #39 lands the bundled stub.
2. PR #40 lands the rescope decision (Option A).
3. This PR (Phase 40 design + impl) lands after — the bundled stub
   it consumes is already merged.

If the maintainer picks Option B or C, this design doc is superseded
and Phase 40 takes a different shape (or is skipped entirely).

## References

- [`docs/new-operator-research.md`](./new-operator-research.md) —
  Phase 37 research + Phase 38½ rescope (this doc's premise)
- [`src/utils/trams.js`](../src/utils/trams.js) — Phase 38 helper
  this PR consumes
- [`assets/tram-stops.json`](../assets/tram-stops.json) — bundled
  catalogue this PR renders
- [`src/utils/operators.js`](../src/utils/operators.js) —
  discriminator extended here
- [`app.js:1227–1241`](../app.js) — `buildIndex()` Promise.all block
  extended here
- [`app.js:4584–4614`](../app.js) — nearby-MTR-stations pattern
  mirrored here
- [`docs/cache-strategy.md`](./cache-strategy.md) — discipline for
  the cache-buster bumps
