# Performance budget

Targets for page weight, time-to-interactive, and runtime resource usage. Exceeding these is a regression that should block a release.

## Page weight (cold load, no cache)

| Asset | Budget | Current | Notes |
| --- | --- | --- | --- |
| `index.html` | ≤ 70 KB | ~24 KB | Includes inlined comment blocks |
| `style.css` | ≤ 130 KB | ~113 KB | Minify in production (Phase 2+) |
| `app.js` | ≤ 400 KB | ~362 KB | Minify in production (Phase 2+) |
| `sw.js` | ≤ 15 KB | ~13 KB | |
| `manifest.json` | ≤ 1 KB | ~0.7 KB | |
| First-paint total (above) | **≤ 620 KB** | **~514 KB** | ✅ |
| `assets/hk-stops.json.gz` (first use) | ≤ 200 KB | ~185 KB | ✅ |
| `planner.min.js` (lazy if applicable) | ≤ 90 KB | ~80 KB | ✅ |

## Time to interactive (TTI)

Measured via Lighthouse on `http://localhost:8765/` against a simulated Slow 4G profile.

| Metric | Budget | Notes |
| --- | --- | --- |
| First Contentful Paint (FCP) | ≤ 1.0 s | HTML + minimal CSS |
| Largest Contentful Paint (LCP) | ≤ 1.5 s | The arrival card on a stop view |
| Time to Interactive (TTI) | ≤ 2.0 s | App is usable for input |
| Total Blocking Time (TBT) | ≤ 100 ms | Long tasks during initial mount |
| Speed Index | ≤ 2.0 s | Visual completeness |

## Runtime resource budget

| Resource | Budget |
| --- | --- |
| JS heap after page load | ≤ 30 MB |
| DOM nodes per view | ≤ 1500 |
| Reflows during a search | ≤ 5 |
| `localStorage` size | ≤ 1 MB (browser default cap is 5 MB; we're well under) |

## API call budget

| Endpoint | Budget |
| --- | --- |
| Stop ETA poll | 60 s interval (single fetch in flight at a time) |
| TD disruption fetch | 24 h (single fetch, daily) |
| GraphHopper routing | per planner search; cached for the same coord pair |
| Plan search | one network round-trip per `findDirect` candidate; budget-bounded by planner short-circuit (v43) |

## Regression detection

- **Lighthouse CI** (planned Phase 2): runs on every PR; PRs that drop Lighthouse scores below the budget fail CI.
- **Hand checks** today: maintainer runs `curl -s -o /dev/null -w '%{size_download}\n'` against `rollroyces.github.io/buseta-hk/app.js` etc. after each push and eyeballs the numbers.

## When to revisit this

After every major release (v50, v100), audit:

- Did `app.js` or `planner.js` grow >10% without a corresponding feature benefit?
- Did a new bundled asset push first-paint over budget?
- Did the trip planner regress on the canonical MA309 → KT924 query?