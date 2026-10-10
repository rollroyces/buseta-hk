# Security Policy

> BusETA HK takes the security of its codebase and its users seriously.
> This document describes how to report a vulnerability, what we
> commit to do when one is reported, and what we ask of reporters.

## Supported Versions

This is a single-version project — there is no LTS / current split.
Every commit on `main` is the supported version.

| Version | Supported                 |
| ------- | ------------------------- |
| `main`  | :white_check_mark: Always |

The live site at <https://rollroyces.github.io/buseta-hk/> is
deployed from the `main` branch. Older releases are not deployed
and not supported — please upgrade by reloading the page (the SW
will pick up the latest commit on next page-load).

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security-sensitive
reports.** Public issues let attackers see the bug before a fix
ships.

Use one of these channels instead:

1. **GitHub private security advisory** (preferred). Open a
   [private security advisory](https://github.com/rollroyces/buseta-hk/security/advisories/new)
   on this repository. GitHub routes it to maintainers privately
   and lets us collaborate on a fix before any public disclosure.
2. **GitHub direct message** to [@rollroyces](https://github.com/rollroyces).
   Open the user's profile, click "Message", and include enough
   detail to reproduce.
3. **Public issue tagged `security`**. Only for low-severity findings
   (e.g. a typo in a security doc, a missing-but-not-vulnerable
   header). Mark it `security` so the maintainer can triage.

### What to include

A good report has:

- The URL / page / data-source where you reproduced it.
- Browser, OS, and app version (visible at the top of the
  in-page release notes — or in DevTools → Application →
  Service Workers → `buseta-vNN`).
- Steps to reproduce, with expected vs. actual behavior.
- For network bugs: the failing fetch's URL + status + headers.
- For XSS / injection bugs: the exact payload you injected,
  plus whether it requires user interaction.

A minimal "this URL does X, expected Y" is enough to begin.

## Response Targets

These are best-effort commitments, not contractual SLAs:

- **Acknowledgement**: within **7 days** of receipt.
- **Triage decision** (accepted / won't-fix / duplicate / needs
  more info): within **14 days**.
- **Fix for confirmed-severe issues**: within **30 days** of
  triage. Critical (active exploitation) issues get a hot-fix
  ahead of the regular release cadence.

## Disclosure Policy

We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure):

1. Reporter and maintainer agree on a fix date (default: 30 days
   after triage, longer if a fix is non-trivial).
2. Maintainer ships the fix (commit + GitHub release + service
   worker update).
3. Maintainer publishes a [GitHub Security advisory](https://docs.github.com/en/code-security/security-advisories/working-with-global-security-advisories-from-the-github-advisory-database/about-the-github-advisory-database)
   crediting the reporter (or anonymous, at the reporter's
   choice).
4. Reporter publishes their writeup (if any) on the agreed date.

We ask reporters to give us a reasonable window before public
disclosure so users can upgrade before the bug is widely known.
We'll honor that window — past 90 days without a fix or disclosure
agreement, you can disclose at will.

## Scope

### In scope

- **XSS / HTML injection** via any user-controlled string that
  ends up in `innerHTML`, `document.write`, `eval`, etc.
- **Service-worker takeover** — any way for an attacker to
  inject code that runs as `buseta-vNN` and persists offline.
- **Cache poisoning** — any way to serve stale JS to users
  after a security fix has shipped.
- **Information disclosure** — leaking the user's location,
  saved stops, or other personal data to a third party.
- **Dependency vulnerabilities** — Dependabot weekly runs cover
  most of these automatically; security-relevant CVEs in our
  `package.json` are tracked here.
- **Anything that lets an attacker write to our GitHub Pages
  deploy** (GH Pages itself is out of our control, but a
  working tamper-detection check is in scope).

### Out of scope

- **The data sources themselves** (`data.etabus.gov.hk`,
  `rt.data.gov.hk`, `opendata.mtr.com.hk`). Report upstream
  bugs to the data providers, not to us.
- **Browser bugs** (Chrome, Safari, Firefox). Report to the
  browser vendor.
- **Self-XSS** — bugs that only affect someone running code
  in their own DevTools console.
- **Denial of service** against the static site (GitHub Pages
  handles this; we have no backend to DoS).
- **Theoretical findings** without a working proof-of-concept
  (we'll mark these as "won't fix" rather than engage).

## Recognition

We credit reporters in the GitHub Security advisory unless they
prefer anonymity. There is no monetary bounty — this is a
volunteer-maintained project. If you'd like to support the
maintainer's work, see the donation links in the README (if any).

## See also

- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — community norms.
- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to contribute non-
  security bug fixes.
- [CHANGELOG.md](./CHANGELOG.md) — what changed, when.
