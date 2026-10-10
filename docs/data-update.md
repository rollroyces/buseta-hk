# Updating bundled data

The app ships with several curated data files in `assets/`. These need occasional manual updates when:

- A new operator opens for data
- The upstream operator changes a stop name / ID
- A new MTR / LRT station opens
- A fare changes

This guide covers the workflow.

## When does a data update need a code change?

| Update | Code change? |
| --- | --- |
| Add a stop to an operator's upstream feed | No (the index rebuild pulls from upstream) |
| Operator changes a stop ID | No (rebuild + bump `INDEX_SCHEMA_VERSION` if the change is structural) |
| Add a new operator (new upstream URL) | Yes (`API.<OPERATOR>_STOPS` in `app.js`, plus UI strings) |
| Add a new LRT / MTR station | No (rebuild), but curated `lrt-stops.json` / `mtr-stops.json` may need a new entry |
| Add a new fare | No (rebuild), but `assets/*-fares.json` needs a new entry |

## Files that need a manual PR

| File | How it's curated | Refresh cadence |
| --- | --- | --- |
| `assets/hk-stops.json` | Compiled from public sources | Per stop update |
| `assets/mtr-stops.json` | Wikipedia MediaWiki API `prop=coordinates` | Per new MTR station |
| `assets/lrt-stops.json` | Same source as above | Per new LRT stop |
| `assets/mtr-lines.json` | Pre-parsed MTR line catalogue (avoids CSV fetch at runtime) | Per MTR line change |
| `assets/lrt-routes.json` | Pre-parsed Light Rail route catalogue | Per LRT route change |
| `assets/*-fares.json` | From operator websites | Per fare change |

## Workflow

1. **Inspect upstream data.** `curl` the operator's open-data endpoint for the latest JSON / XML.
2. **Identify deltas.** Compare the existing curated file against the latest upstream. Use `jq` or a quick script.
3. **Update the curated file.** Edit / add / remove entries.
4. **Validate JSON syntax.** `jq . < assets/hk-stops.json > /dev/null` (or similar).
5. **Bump the cache-buster.** The asset URL is `assets/hk-stops.json?v=N` — bump `N` so the SWR cache flushes. (Also update `API.HK_STOPS` in `app.js`.)
6. **Bump `INDEX_SCHEMA_VERSION`** if the shape of `state.index` changes.
7. **Bump `buseta-version`** + `?v=` cache-buster + `sw.js` `CACHE` per [CONTRIBUTING.md](../CONTRIBUTING.md).
8. **Open a PR** with the `assets` label so it gets the right CODEOWNERS review.

## Validation

After deploy:

1. Hard-refresh the app.
2. Visit a stop that uses the updated data.
3. Confirm the new stop ID / fare / etc. is rendered correctly.
4. Check `localStorage.state.index` in DevTools — the rebuilt index should reflect the change.

## Common issues

- **Stop not appearing**: `assets/hk-stops.json` missing an entry, or `INDEX_SCHEMA_VERSION` not bumped. Check DevTools console for `[buseta] index rebuild needed`.
- **Wrong fare**: `assets/<op>-fares.json` has an old entry. Compare with operator website.
- **Curated LRT stop missing**: `lrt-stops.json` doesn't include it; the planner falls back to `0 m` ride legs (v45 TODO).