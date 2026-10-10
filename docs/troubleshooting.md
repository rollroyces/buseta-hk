# Troubleshooting

Common issues and their fixes. If your problem isn't listed, please open an issue.

## The app shows "暫無到站時間" for a stop that should have buses

**Cause 1: Off-peak hours.** Most operators run fewer buses outside rush hour. The v35 release added dimmed no-ETA cards for routes that serve the stop but have no live bus in the upstream horizon.

**Cause 2: Operator-facing vs. internal stop code.** KMB upstream `/stop-eta/{id}` only accepts the **internal 16-hex** ID (e.g. `0C81107C4ABFCD56`), not the operator-facing code on the bus stop sign (e.g. `MA973`). v36 added automatic conversion. If you're using an old cached version, hard-refresh: `Cmd+Shift+R` (macOS) / `Ctrl+Shift+R` (Windows / Linux).

**Cause 3: Stop is genuinely not in the upstream feed.** Some stops exist only in our local index but not in KMB / CTB. Open an issue with the stop name + the operator-facing code.

## The app is stuck showing the splash screen

**Cause: Service worker from an older deployment.** Hard-refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`) to bypass the SW cache.

## A saved route / stop is missing

**Cause: localStorage was cleared** (browser data clear, different browser, private mode). Saved routes don't sync — they're local. v34 added `pruneRecentStops()` which removes unresolvable entries on every load.

## The trip planner says "暫時搵唔到合適嘅路線"

**Cause 1: Pure-rail query.** v43 added a short-circuit so MTR↔MTR queries don't fall through to the bus sub-planner. The result should still appear in the rail section.

**Cause 2: Cross-mode not yet recognised.** v48–v52.2 added cross-mode (bus + MTR / LRT) routing, but only for stops within ~500 m of a rail station. If your origin is more remote, the planner may show only the long bus option.

**Cause 3: Cached stale planner data.** v46 fixed a bug where recent-row clicks didn't update `field.dataset.stopId`. Hard-refresh.

## Geolocation doesn't work

**Cause 1: Permission not granted.** The app prompts for location only when you tap into the search tab. If you declined, browser settings need to be reset.

**Cause 2: HTTPS required.** Modern browsers only expose `navigator.geolocation` over HTTPS (or `file://`). GitHub Pages uses HTTPS so this should work; local development over plain HTTP won't.

**Cause 3: Browser blocked.** Some browsers (especially in private mode) disable geolocation entirely.

## The app is in the wrong language

The default is 繁體中文 (`zh-Hant`). To switch:

1. Open Settings (gear icon)
2. Tap "語言 / Language"
3. Pick your preferred locale

Your preference is stored in `localStorage`. If you clear browser data, it reverts to the default.

## "Failed to load" banner / Network error

**Cause**: upstream API is down or being blocked. The TD / KMB / CTB endpoints occasionally have outages. Try again in a few minutes. The app also falls back to a 5-minute SWR cache so recent data is shown while the API recovers.

## PWA won't install

**Cause 1: iOS Safari** — only Safari can install PWAs on iOS. Chrome / Firefox on iOS use Safari's engine underneath and can't install.

**Cause 2: HTTPS required** — same as geolocation. Service workers only register over HTTPS.

**Cause 3: Already installed** — check your home screen / app launcher.

## "out of memory" on very old devices

**Cause**: the bundled `hk-stops.json.gz` decompresses to ~670 KB and the in-memory index can hit ~30 MB. On very old devices (≤ 2 GB RAM), the parse may OOM. There's no in-app fix; on those devices, please use the operator's official app.