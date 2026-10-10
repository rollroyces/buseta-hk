# Deployment

BusETA HK is a pure-static app — any host that serves HTML, CSS, and JSON works. Below are quick recipes for the most common hosts.

## GitHub Pages (default)

The repo has Pages enabled (`has_pages: true`) and auto-deploys from `main`. No config needed. After every push to `main`:

1. GitHub builds (no build step — files are copied as-is)
2. GitHub serves from `https://<owner>.github.io/<repo>/`
3. The service worker caches the new files on the user's next visit; the version bump (`buseta-version` + `CACHE`) forces a clean install

URL: `https://rollroyces.github.io/buseta-hk/`

To enable or configure:

- **Settings → Pages**: source = `Deploy from a branch`, branch = `main`, folder = `/` (root).
- **Custom domain**: add a `CNAME` file at the repo root with the domain name, then update DNS.

## Netlify

Drop the repo into Netlify. No build command needed. Publish directory: `/` (root).

Create a `netlify.toml` at the repo root:

```toml
[build]
  publish = "/"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=86400"
```

The `Cache-Control: no-cache` on `sw.js` ensures the service worker always picks up the latest version.

## Cloudflare Pages

Connect the GitHub repo. Build command: (empty). Build output directory: `/`. Add a `_headers` file at the root:

```
/sw.js
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=86400
```

## S3 + CloudFront

```bash
# sync the static files
aws s3 sync . s3://buseta-hk.example.com/ \
  --exclude ".git/*" --exclude "tests/*" --exclude ".github/*" \
  --exclude "package*.json" --exclude "vitest.config.js"

# invalidate the CloudFront cache so the new service worker is picked up
aws cloudfront create-invalidation \
  --distribution-id E123ABC \
  --paths "/sw.js" "/index.html"
```

## Local server (development)

Any static server works:

```bash
python3 -m http.server 8765
# or
npx serve .
# or
php -S localhost:8765
```

Then open `http://localhost:8765/`.

> Opening `index.html` directly via `file://` works for the UI, but the API calls may be blocked by CORS depending on the browser. Use a local server.

## Pre-deploy checklist

- [ ] `index.html` `<meta name="buseta-version">` bumped to the new version
- [ ] `index.html` `?v=` cache-busters on JS / CSS script tags bumped
- [ ] `sw.js` `const CACHE = 'buseta-vNN'` bumped in lock-step with `buseta-version`
- [ ] `planner.min.js` and `planner.min.css` regenerated from source
- [ ] `assets/*.json` data files updated (if applicable)
- [ ] Smoke-tested locally with `python3 -m http.server`
- [ ] CHANGELOG.md updated under the new version heading