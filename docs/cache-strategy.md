# Cache-buster strategy

> Single source of truth for the cache-buster discipline. Any change to the
> rules below must update [`tests/unit/cache-buster.test.js`](../tests/unit/cache-buster.test.js)
> so the test enforces what this doc promises.

BusETA HK is deployed as a PWA. Every user is loading the site through a
service worker that aggressively caches the JS / CSS / HTML shell. To roll
out a new version we have to **simultaneously invalidate five different
caches** so no user accidentally keeps running the old code against the new
data (or vice versa).

## The six knobs

| Knob                           | File         | Purpose                                                                                                                                           | Lives at                                                   |
| ------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `<meta name="buseta-version">` | `index.html` | Overall release counter — visible in source and used by `sw.js` to detect version drift. Monotonically increases on every JS/CSS-touching commit. | Top of `<head>` (line 20)                                  |
| `app.js?v=N`                   | `index.html` | Last bump of `app.js`. Lazy-loaded, also imports `style.css`.                                                                                     | `<script defer src="app.js?v=N">` (line ~1545)             |
| `planner.js?v=N`               | `index.html` | Last bump of `planner.js`. Lazy-loaded via `window.__buseta.loadPlannerScript()`.                                                                 | The loader is in an inline `<script>` (line ~1500)         |
| `planner.css?v=N`              | `index.html` | Last bump of `planner.css`. Lazy-loaded via `window.__buseta.loadPlannerCss()`.                                                                   | Same inline `<script>` (line ~1514)                        |
| `style.css?v=N`                | `index.html` | Last bump of `style.css`.                                                                                                                         | `<link rel="stylesheet" href="style.css?v=N">` (line ~660) |
| `sw.js const CACHE`            | `sw.js`      | Service-worker cache version. Used as the cache key for the precache list. Must be ≥ max(asset ?v=) so the SW correctly invalidates older assets. | `const CACHE = 'buseta-vN';` (line ~36)                    |

The 12 `src/utils/*.js` files have their own `?v=1` query strings (set in
Phase 3). They're first-load assets — no need to bump on every phase;
bump when the file's _contents_ change materially.

## Discipline

Every JS / CSS / SW-touching commit must bump **all six knobs in lock-step**:

| Knob             | When to bump                           |
| ---------------- | -------------------------------------- |
| `meta`           | Always (every JS/CSS-touching commit). |
| `app.js?v=`      | When `app.js` changes.                 |
| `planner.js?v=`  | When `planner.js` changes.             |
| `planner.css?v=` | When `planner.css` changes.            |
| `style.css?v=`   | When `style.css` changes.              |
| `sw.js CACHE`    | Always (every JS/CSS-touching commit). |

A docs-only PR (e.g. `README.md`, `CHANGELOG.md`, this file) does **not**
bump any knob — those files are not cached by the SW.

A test-only PR (e.g. `tests/unit/*.test.js`) does **not** bump any knob —
those files are dev-only and never loaded by the deployed PWA.

## Invariants

These invariants are enforced at test time by
[`tests/unit/cache-buster.test.js`](../tests/unit/cache-buster.test.js):

1. **Every value parses as a positive integer.** A regression that
   wrote `?v=1.61` or `?v=NaN` fails immediately.

2. **`meta >= max(app.js?v, planner.js?v, planner.css?v, style.css?v)`.**
   Catches the case where one of the four asset `?v=` was bumped but
   the meta tag was forgotten (so the source-of-truth `meta` lies
   about the release).

3. **`sw.js CACHE >= max(asset ?v=)`.** Catches the case where an
   asset `?v=` was bumped but `sw.js` wasn't — users on a stale SW
   would keep getting the old asset from cache.

4. **`app.js?v >= style.css?v`.** Catches the case where `style.css`
   was bumped but `app.js` wasn't (or vice versa — `app.js` imports
   the stylesheet, so they should move together).

5. **`planner.js?v >= planner.css?v`.** Same idea for the planner pair.

6. **All values `< 9999`.** Paranoia check against `?v=11000` typos.
   Current real-world values are well under 100. If we ever legitimately
   exceed 9999, bump this guard.

## Worked examples

### Phase 19 — refactor: planner.js drops local mapWithCap

Touched: `planner.js` only (no other JS / CSS changed).

| Knob             | Before       | After            |
| ---------------- | ------------ | ---------------- |
| `meta`           | `71`         | `72`             |
| `app.js?v=`      | `61`         | `61` (unchanged) |
| `planner.js?v=`  | `39`         | `40`             |
| `planner.css?v=` | `37`         | `37` (unchanged) |
| `style.css?v=`   | `39`         | `39` (unchanged) |
| `sw.js CACHE`    | `buseta-v60` | `buseta-v61`     |

Notice: `meta`, the touched asset's `?v=`, and `sw.js CACHE` all bump;
the other three stay put.

### Phase 16 — feat(a11y): aria-live summary region

Touched: `app.js`, `index.html`, `style.css`, `src/utils/stop-view-summary.js` (new), `tests/unit/stop-view-summary.test.js` (new).

| Knob                                | Before       | After            |
| ----------------------------------- | ------------ | ---------------- |
| `meta`                              | `68`         | `69`             |
| `app.js?v=`                         | `58`         | `59`             |
| `planner.js?v=`                     | `34`         | `34` (unchanged) |
| `planner.css?v=`                    | `37`         | `37` (unchanged) |
| `style.css?v=`                      | `38`         | `39`             |
| `sw.js CACHE`                       | `buseta-v57` | `buseta-v58`     |
| `src/utils/stop-view-summary.js?v=` | —            | `1` (first load) |

Notice: every bumped asset (`app.js`, `style.css`) plus `meta` plus `sw.js`
CACHE all move; the planner pair and the unchanged `src/utils/` files
stay put. The new `src/utils/stop-view-summary.js?v=1` is its first load.

## Adding a new asset

1. Add the file under `src/` or update `index.html`.
2. Pick a fresh `?v=N` — start at `1` for new `src/utils/*.js`; for
   inline changes, bump the next-existing counter.
3. Update `index.html` to reference it.
4. **Update [`tests/unit/cache-buster.test.js`](../tests/unit/cache-buster.test.js)**
   if you added a new knob. The test must know how to scrape it.
5. Run `npx vitest run tests/unit/cache-buster.test.js` locally before
   pushing.

## What this strategy does _not_ cover

- **HTML content inside `<main>` (e.g. release notes)** is not
  cache-busted — users see the in-page release notes from the cached
  `index.html` until the SW gets the new one. The `meta` tag in `<head>`
  forces a fresh `index.html` fetch on the next page load, so this
  self-corrects on the next navigation.
- **`assets/*.json.gz` and `assets/*.png`** are loaded directly by
  `app.js` via `fetch()` / `<img>` and bypass the SW's precache list.
  They live in `ETA_CACHE` / `ASSET_CACHE` and are versioned by URL
  path, not `?v=`.
- **GitHub Pages atom-feed caching** — outside the SW's control. A new
  deploy can take up to ~10 minutes to propagate via CDN. Not a
  cache-buster issue, just a deploy cadence issue.
