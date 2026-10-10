# Contributing to BusETA HK

Thanks for your interest in making Hong Kong's bus arrivals app better. This
guide covers the day-to-day workflow for opening a PR.

> BusETA HK is a personal project by [@rollroyces](https://github.com/rollroyces).
> It's small, vanilla, and deliberately has no build step. Please read this
> guide top-to-bottom before opening your first PR — most of the friction we
> avoid is friction we'd rather not re-litigate on every review.

## TL;DR

```bash
git clone https://github.com/rollroyces/buseta-hk.git
cd buseta-hk
npm install
npm run check        # runs the full quality gate (~45s)
npm test -- --watch  # re-runs tests on file change
```

Before pushing:

```bash
npm run check:fix    # auto-fix lint + format
npm run check        # confirm everything is green
```

## Project conventions

### No build step

BusETA HK is **vanilla JavaScript** served as static files. There is no
TypeScript, no JSX, no bundler, no transpilation, no framework. The
deployed bundle is what the source files contain, byte-for-byte.

This is a deliberate choice and a hard constraint. PRs that add a
build step, a framework dependency, or a transpilation pipeline will
be rejected.

### Cache-buster discipline

Every JS / CSS / SW-touching commit must bump **six knobs in lock-step**:

| Knob             | File         | When to bump                          |
| ---------------- | ------------ | ------------------------------------- |
| `<meta>`         | `index.html` | Always (every JS/CSS-touching commit) |
| `app.js?v=`      | `index.html` | When `app.js` changes                 |
| `planner.js?v=`  | `index.html` | When `planner.js` changes             |
| `planner.css?v=` | `index.html` | When `planner.css` changes            |
| `style.css?v=`   | `index.html` | When `style.css` changes              |
| `sw.js CACHE`    | `sw.js`      | Always (every JS/CSS-touching commit) |

Docs-only and test-only commits do **not** bump any knob.

A test enforces this discipline on every PR — see
[`docs/cache-strategy.md`](docs/cache-strategy.md) for the full story
and the rationale. If `npm run check` complains, the test will tell
you exactly which invariant broke.

### One phase per PR

Each piece of work is its own branch + PR. Branches are named
`enhance/phase<N>-<short-slug>` (e.g. `enhance/phase27-community-docs`).
PRs merge in numeric order; a later phase may depend on an earlier
phase's code.

For multi-PR work (e.g. adding a new operator), open the first PR and
wait for review before starting the next — incremental review is
cheaper than big-bang review.

### Tests are required for new code

Every new helper in `src/utils/` must have a matching test in
`tests/unit/`. The 189-test suite runs in ~42s; if you're adding a
test that takes more than 1s on its own, profile it.

If your change touches `app.js` or `planner.js` behavior, write a
test that exercises the change before opening the PR. The CI
workflow (`.github/workflows/ci.yml`) runs `npm run check` on every
PR — if `npm test` fails, the PR is blocked.

### i18n parity

If you add or modify a string key in `app.js`'s `STRINGS` table, you
**must** add it to all three language blocks (`zh-Hant`, `en`,
`zh-Hans`). `npm run lint:i18n` enforces this — a missing key is a
CI failure.

If you're unsure of the translation, use a placeholder and add a TODO
in the PR description; reviewers can help translate it.

## Workflow

### 1. Pick an issue or open one

Look for an [open issue](https://github.com/rollroyces/buseta-hk/issues)
labeled `good first issue` if you're new. Otherwise, open an issue
first describing what you'd like to change. Big PRs without prior
discussion are likely to be deferred.

### 2. Create a branch

```bash
git checkout -b enhance/phase28-<short-slug>
```

### 3. Write code + tests

Keep changes focused. If your PR touches more than ~200 lines of
production code (`app.js`, `planner.js`, `sw.js`, `src/utils/`), it's
probably doing too much — split it.

### 4. Run the full check

```bash
npm run check:fix    # auto-fix
npm run check        # confirm green
```

Both must pass before pushing.

### 5. Commit

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: …` — new user-facing feature
- `fix: …` — bug fix
- `refactor: …` — code change that neither fixes a bug nor adds a feature
- `chore: …` — tooling, CI, deps, build changes
- `docs: …` — docs only
- `style: …` — formatting / whitespace only
- `test: …` — adding or fixing tests
- `ci: …` — CI configuration

Examples from this repo's history:

```
feat(a11y): modal focus trap for share/QR dialog (Phase 15)
chore: wire up ESLint 9 flat config (Phase 23)
docs(cache): create cache-strategy.md as source-of-truth (Phase 22)
```

### 6. Push + open PR

```bash
git push -u origin enhance/phase28-<short-slug>
```

Open the PR against `main`. Fill in the [PR template](.github/PULL_REQUEST_TEMPLATE.md).

### 7. Wait for CI

`.github/workflows/ci.yml` runs `npm run check` on every PR. If CI is
red, the PR can't merge — fix and push again.

### 8. Wait for review

Reviews usually happen within a few days. Don't open a "any update?"
comment — if it's been a week and there's no review, ping
[@rollroyces](https://github.com/rollroyces).

## File map

```
 app.js              ~9k lines — main app shell
 planner.js          ~3.8k lines — journey planner
 sw.js               ~340 lines — service worker
 index.html          SPA shell + cache-buster meta + in-page release notes
 style.css           ~117k — main stylesheet
 planner.css         ~18k — planner-specific styles
 src/utils/*.js      12 pure-helper modules (all tested)
 tests/unit/*.js     14 test files, 189 tests
 scripts/            Node CLI helpers + Pillow-based icon generator
 docs/               Markdown design docs (cache-strategy.md is the main one)
 assets/             Data JSONs (fares, stops, lines, routes) + PNG icons
 .github/workflows/  CI + Lighthouse + OpenSSF Scorecard
 eslint.config.mjs   ESLint 9 flat config (Phase 23)
 .editorconfig       Cross-editor formatting defaults (Phase 23)
 .prettierrc.json    Prettier defaults (2-space, LF, single quotes)
 CHANGELOG.md        Per-PR release log (Phase 20, kept current by Phase 26+)
```

## What won't be merged

- Build-step tooling (webpack, vite, rollup, esbuild, …) — the project is intentionally vanilla.
- Framework dependencies (React, Vue, Svelte, …) — same.
- New upstream API credentials / keys — the project uses only public, unauthenticated endpoints.
- Real-time data from sources not listed in the README's "Data sources" table — without discussion first.
- Anything that increases the page-weight budget without clear user value.

## Reporting security issues

See [SECURITY.md](SECURITY.md). (Note: as of Phase 27, SECURITY.md
is not yet on `main`. A future PR will land it. In the meantime,
DM [@rollroyces on GitHub](https://github.com/rollroyces).)

## License

By contributing, you agree that your contributions will be licensed
under the [MIT License](LICENSE) — the same as the project.
