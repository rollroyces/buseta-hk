# Frequently Asked Questions

## For users

### Why is my stop showing "暫無到站時間"?

Three common causes. See [troubleshooting.md](./troubleshooting.md) for the full list.

1. **Off-peak hours.** Most operators run fewer buses outside rush hour.
2. **Stale service worker.** Hard-refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`).
3. **Stop genuinely not in the upstream feed.** Open an issue with the stop name.

### Does the app work offline?

**Partially.** The app shell, bundled assets, and the 5-minute SWR cache for ETA responses are all available offline. The trip planner's walking segments fall back to haversine estimates when GraphHopper is unreachable. See [cache-strategy.md](./cache-strategy.md) for the full bucket layout.

### Why no tram / ferry / MTR Bus?

See the [operator coverage matrix](./operators.md). Short answer: those operators don't publish CORS-enabled, real-time open data. Use the operator-coverage issue template to request a new operator.

### Is my data sent anywhere?

**No.** The app is fully client-side. Saved routes / stops / stations live in `localStorage`. No analytics, no telemetry, no error reporting. The only network calls are to the upstream transit APIs listed in [api.md](./api.md).

### Can I install it as a PWA?

**Yes.** Open the site in a browser that supports PWA installation (Chrome, Edge, Safari on iOS / macOS). Tap "Add to Home Screen" / "Install". See [deploy.md](./deploy.md) for caveats.

### How do I switch language?

Settings → 語言 / Language. Choice is stored in `localStorage`.

## For contributors

### Where do I start?

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the dev setup. Open the repo in GitHub Codespaces (uses `.devcontainer/devcontainer.json`) or clone + open in VS Code locally.

### How do I run tests?

```bash
npm install
npm test            # one-shot
npm run test:watch  # watch mode
```

Tests live in `tests/`. Today there are 5 smoke tests (Phase 2 will add real coverage of extracted helpers).

### How do I add a new locale?

See [localization.md](./localization.md). Short version:

1. Add a top-level entry to the `STRINGS` table inside `app.js`.
2. Add the locale code to the language picker.
3. Translate each key.
4. Bump `buseta-version` + `?v=` cache-buster + `sw.js` CACHE per [CONTRIBUTING.md](../CONTRIBUTING.md).

### How do I add a new transit operator?

See [operators.md](./operators.md) and the operator-coverage issue template. Real-time API + CORS-enabled + no API key is the requirement.

### What's the code style?

- Vanilla JS, no TypeScript, no JSX
- 2-space indent, single quotes, trailing commas, LF line endings
- See [.editorconfig](../.editorconfig), [.prettierrc.json](../.prettierrc.json), [.eslintrc.json](../.eslintrc.json)

### What if my change touches `app.js` / `planner.js` / `style.css` / `planner.css`?

**Bump cache-busters in lock-step:**

- `index.html` `<meta name="buseta-version">`
- `index.html` `<script src="...app.js?v=NN">` and similar
- `sw.js` `const CACHE = 'buseta-vNN'`

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full cache-buster workflow.

### How do I get my PR merged?

1. Open an issue first (for any substantial feature)
2. Make focused commits with conventional-commits messages
3. Run `npm run lint && npm test` before pushing
4. Wait for the CODEOWNERS auto-assigned reviewer

## For maintainers

### How do I deploy?

See [deploy.md](./deploy.md). GitHub Pages is the default. The repo auto-deploys from `main`.

### How do I refresh bundled data?

See [data-update.md](./data-update.md). Most updates are JSON edits + cache-buster bumps.

### How does the trip planner work?

In-source `vNN:` comments in `planner.js` cover the algorithm. Key milestones:

- **v41** — strategy-based routing (Bus / Rail / Mixed)
- **v42** — real km via haversine, route-shape canvas, km summary
- **v43** — pure-rail short-circuit (~6 s → <100 ms)
- **v45** — LRT curated stops (lat/lng)
- **v47** — real walking via GraphHopper
- **v48** — cross-mode routing (rail relaxes to nearest station + walkLeg)
- **v52** — mixed bus+rail journeys
- **v52.2** — proximity-based bus stop lookup for cross-mode cases

### What's the version bump cadence?

- `buseta-version` (in `index.html`): every user-visible change
- `sw.js` `CACHE`: in lock-step with `buseta-version`
- `?v=NN` cache-busters: every time the underlying JS / CSS changes
- `INDEX_SCHEMA_VERSION` (in `app.js`): when `state.index` shape changes