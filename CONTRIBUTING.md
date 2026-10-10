# Contributing to BusETA HK

Thank you for your interest in contributing! BusETA HK is a small, fast, vanilla-JS progressive web app for real-time Hong Kong transit arrivals across KMB, LWB, Citybus, NWFB, green minibus, MTR heavy rail, and Light Rail.

## Quick start

The app has **zero runtime dependencies and zero build step**. Everything ships from source files.

```bash
# Clone
git clone https://github.com/rollroyces/buseta-hk.git
cd buseta-hk

# Serve locally — any static server works
python3 -m http.server 8765
# then open http://localhost:8765
```

(Opening `index.html` directly via `file://` works for the UI, but the API calls may be blocked by CORS depending on the browser. Use a local server.)

## Development setup (optional)

For linting, formatting, and tests:

```bash
npm install            # devDeps: eslint, prettier, vitest
npm run lint           # eslint check
npm run lint:fix       # eslint --fix
npm run format         # write prettier
npm run format:check   # read-only check
npm test               # vitest smoke tests
```

## Code style

- **Vanilla JS** — no TypeScript, no JSX, no frameworks. The app runs in every modern browser without transpilation.
- **2-space indentation, single quotes, trailing commas, semicolons** — enforced by `.editorconfig` and `.prettierrc.json`.
- **Linting** is enforced on every PR via `.github/workflows/ci.yml`. Run `npm run lint` locally before pushing.

## Commit format

BusETA HK uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short summary>

[optional body with technical detail]
```

Common types:

- `feat:` — new user-facing feature
- `fix:` — bug fix
- `chore:` — repo hygiene (deps, configs, scripts)
- `docs:` — README / CHANGELOG / inline docs
- `refactor:` — code restructure without behaviour change
- `perf:` — performance improvement

The versioned release format is `vNN: <summary>` (e.g. `v54: ...`). The current version is tracked in `index.html` (`<meta name="buseta-version">`) and the service-worker `CACHE` constant in `sw.js`. Major changes are recorded in `CHANGELOG.md`.

## Pull requests

1. Fork and create a branch (`git checkout -b feat/short-name`)
2. Make focused commits with conventional messages
3. Run `npm run lint && npm test` before pushing
4. Open a PR against `main` with a clear summary of the user impact
5. Reference any related issue

For substantial features, open an issue first to discuss the approach.

## File guide

| File | Purpose |
| --- | --- |
| `app.js` (~362 KB) | Main app logic, vanilla JS |
| `planner.js` (~145 KB) | Trip planner sub-app |
| `index.html` | Single-page shell with hash routing |
| `style.css` (~113 KB) | Mobile-first CSS, dark-mode aware |
| `planner.css` | Planner-specific CSS |
| `sw.js` | Service worker (PWA, cache strategy) |
| `manifest.json` | PWA manifest |
| `assets/` | Data files (stops, routes, fares), icons, supporting libs |

`planner.min.js` and `planner.min.css` are pre-minified siblings of the source files. Don't edit them by hand.

## Cache busting

JS and CSS files are loaded with a `?v=NN` cache-buster in `index.html`. When you change `app.js` / `planner.js` / `style.css` / `planner.css`, increment the matching `?v=` and the `buseta-version` meta tag. The service-worker `CACHE` constant (`buseta-vNN` in `sw.js`) is bumped to force clean installs on existing users.

## License

MIT — see [LICENSE](./LICENSE). By contributing, you agree your contributions are MIT-licensed.