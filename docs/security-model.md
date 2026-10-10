# Security model

BusETA HK is a fully client-side web app. The security model reflects that — there is no backend to compromise, but the browser side still has to handle data integrity, privacy, and abuse-resistance.

## Trust boundaries

```
┌──────────────────────┐         ┌──────────────────────┐
│  User's browser      │         │  Upstream APIs        │
│  (untrusted input)   │  HTTPS  │  (semi-trusted)       │
│                      │ ───────► │                       │
│  app.js              │         │  data.etabus.gov.hk    │
│  planner.js          │         │  rt.data.gov.hk        │
│  sw.js               │         │  data.etagmb.gov.hk    │
│  service worker      │         │  opendata.mtr.com.hk   │
│  localStorage        │         │  routing.openstreetmap │
│                      │ ◄─────── │  td.gov.hk (XML)       │
└──────────────────────┘         └──────────────────────┘
        │                                    │
        │ reads                              │
        ▼                                    ▼
  assets/* (bundled with the repo, shipped via the same origin)
```

**Trusted**: the repo source (`app.js`, `planner.js`, `sw.js`, `assets/*`) is signed by the GitHub Pages HTTPS cert. Anyone who can write to the repo can ship code to users — that's the entire trust model.

**Semi-trusted**: the upstream APIs are operated by the Transport Department and MTR Corporation. We assume they're well-meaning but the data may be malformed, late, or temporarily unavailable.

**Untrusted**: anything from the user (search input, geolocation, saved routes) is treated as hostile.

## Threats

### T1. Malicious upstream API response

**Risk**: an upstream API returns data that triggers an XSS in our renderer.

**Mitigation**:
- All API responses are parsed with `JSON.parse` / `DOMParser` — never via `innerHTML` of unsanitised content.
- Every string written to the DOM uses `textContent` or goes through the `STRINGS` table (when sourced from the API, values are inserted as text nodes, not HTML).
- The TD XML feed is parsed with `DOMParser`; `parsererror` elements trigger a fallback to `[]`.

### T2. Service worker poisoning

**Risk**: a malicious or buggy service worker persists across upgrades and serves stale or altered content.

**Mitigation**:
- The SW has no `fetch` handlers for cross-origin URLs except via the SWR branches (cache-first for known good content, network with SWR fallback for live APIs).
- `caches.delete()` runs in the activate handler on every version bump, so old buckets are purged.
- The SW is served with `Cache-Control: no-cache` on Netlify / Cloudflare (see [deploy.md](./deploy.md)).

### T3. Local data exfiltration

**Risk**: malicious JS (or a bug) sends `localStorage` contents to a third party.

**Mitigation**:
- The app makes **zero** third-party API calls beyond the upstream transit APIs.
- No analytics, no telemetry, no error reporting service. (See the Privacy section in the README.)
- All `fetch()` URLs are statically referenced in the source — no string-concatenated URLs that could be redirected by upstream data.

### T4. Geolocation leak

**Risk**: the app reveals the user's location to the network even when they didn't opt in.

**Mitigation**:
- `navigator.geolocation.getCurrentPosition()` is only called when the user taps into the search tab AND explicitly enables location.
- The location is used only client-side (e.g. to find nearby stops); it is never sent to any server.

### T5. Saved-routes tamper

**Risk**: a malicious browser extension or shared device modifies `localStorage` to corrupt saved routes.

**Mitigation**:
- Saved routes are validated against the local `state.index` on every read. Unknown routes / stops are dropped via `pruneRecentStops()` (v34).
- The localStorage schema is documented in the codebase; mismatches trigger an automatic rebuild.

### T6. CDN / hosting takeover

**Risk**: GitHub Pages (or the user's DNS) is compromised and the deployed app is altered.

**Mitigation**:
- GitHub enforces 2FA on accounts with Pages access.
- The repo is public — anyone can audit the source.
- A compromised deployment can be rolled back by reverting the offending commit; the SW's activate handler will purge the poisoned cache on the next visit.

### T7. Dependency supply chain

**Risk**: a dev-time dependency (eslint, prettier, vitest, jsdom) is compromised and ships malicious code.

**Mitigation**:
- DevDeps only — they don't ship to users. A compromised devDep would only affect maintainers' machines.
- Dependabot opens weekly PRs to keep devDeps current; majors are ignored for manual review.
- CodeQL runs weekly to catch any malicious code patterns introduced via devDeps.

## Reporting

See [SECURITY.md](../SECURITY.md) for the private disclosure process.