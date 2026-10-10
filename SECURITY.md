# Security Policy

## Supported versions

BusETA HK is a single-page web app deployed from the `main` branch to GitHub Pages. The current production deployment is whichever commit was last pushed to `main`. Earlier versions are not patched — please redeploy from `main` to pick up fixes.

| Version | Supported |
| --- | --- |
| Latest commit on `main` (the deployed site) | ✅ |
| Older commits / older versions | ❌ |

## Reporting a vulnerability

Please report security issues privately via [GitHub Security Advisories](https://github.com/rollroyces/buseta-hk/security/advisories/new) for this repository. **Do not open a public issue** for suspected vulnerabilities — give the maintainer a chance to fix it first.

When reporting, please include:

- A clear description of the issue and its impact
- Steps to reproduce (or a minimal proof-of-concept)
- The deployment / commit SHA you saw the issue on (visible via the `buseta-version` meta tag in the page source)
- Whether you'd like to be credited in the fix

The maintainer aims to acknowledge reports within **3 business days** and to ship a fix or mitigation within **14 days** of confirmation. The fix will land on `main`, be deployed automatically via GitHub Pages, and the user-visible `buseta-version` will be bumped in the process.

## Scope

BusETA HK runs entirely in the browser. The app:

- Calls public, unauthenticated APIs at `data.etabus.gov.hk`, `rt.data.gov.hk`, `data.etagmb.gov.hk`, `opendata.mtr.com.hk`. The app does not proxy or modify these responses.
- Uses `localStorage` for saved routes, stops, and stations. The app does not exfiltrate this data anywhere.
- Uses the Geolocation API only when the user opts in via the search tab.

The service worker (`sw.js`) caches responses from these same origins plus the static assets shipped in this repo. No external CDN, analytics, or third-party scripts are loaded at runtime.

## Out of scope

- Vulnerabilities in third-party APIs (report those upstream — `data.gov.hk`, MTR, KMB, etc.)
- Browser-specific bugs in very old versions no longer in use
- Social-engineering / phishing related to the BusETA HK brand