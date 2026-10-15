## Summary

<!-- 1-3 sentences. What does this PR do, and why? Reference any open
     issue it closes with `Closes #NN`. -->

## Type of change

<!-- Mark with an `x` for applicable items. Delete the rest. -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Refactor (no functional change)
- [ ] Chore (tooling, deps, CI, build)
- [ ] Docs (markdown only)
- [ ] Test (adding or fixing tests)

## Checklist

<!-- Mark with an `x` for completed items. Delete the rest. -->

- [ ] `npm run check` passes locally (lint + lint:i18n + lint:cache-buster + format + test)
- [ ] New code in `src/utils/` has matching tests in `tests/unit/`
- [ ] If strings in `app.js`'s `STRINGS` table changed, all three lang blocks updated (`npm run lint:i18n` is green)
- [ ] If JS / CSS / SW was touched, cache-buster knobs bumped (`<meta>`, `?v=` query strings, `sw.js const CACHE` — see [docs/cache-strategy.md](docs/cache-strategy.md))
- [ ] `CHANGELOG.md` updated (the `## Unreleased` block under each category — Added / Changed / Fixed / Removed)
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] Branch is named `enhance/phase<N>-<short-slug>`

## Cache-buster bumps

<!-- If this PR touches JS / CSS / SW, fill in the before/after table.
     Docs-only and test-only PRs delete this whole section. -->

| Knob               | Before | After |
| ------------------ | ------ | ----- |
| `<meta>`           |        |          |
| `app.js?v=`        |        |          |
| `planner.js?v=`    |        |          |
| `planner.css?v=`   |        |          |
| `style.css?v=`     |        |          |
| `sw.js CACHE`      |        |          |

## Verification

<!-- Copy-paste the relevant lines from `npm run check`. -->

```
npm run lint              → clean
npm run lint:i18n         → clean
npm run lint:cache-buster → clean
npm run format:check      → clean
npm test                  → NNN/NNN passing
```

## Out of scope

<!-- What did you deliberately leave for a follow-up PR? Use this to
     surface adjacent work that reviewers might otherwise assume is in
     scope. -->

## Merge order

<!-- Optional. State the recommended phase number this PR slots into
     (e.g. "Recommended: #1 → #2 → … → #26 → #27 → #28"). Skip if this
     PR is independent of any in-flight work. -->