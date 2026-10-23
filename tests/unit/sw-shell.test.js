// Tests for the service worker's shell precache list and cache versioning.
//
// Phase 47 — two long-standing SW defects that no test caught:
//
//  1. The cleanup threshold in the activate handler was a SECOND
//     hand-maintained literal (`parseInt(m[1], 10) < 65`) that had to be
//     bumped alongside `const CACHE = 'buseta-vN'`. It drifted repeatedly
//     (44 while CACHE was v64, then 65 while CACHE was v66), leaking one
//     stale ~700 KB cache bucket per release.
//
//  2. `SHELL` stored `/app.js` and `/style.css` WITHOUT their `?v=`
//     query string, but the page requests `/app.js?v=67`. The
//     same-origin branch used an exact-match `caches.match(req)`, so the
//     precached copies were written on install and then never served.
//
// This test locks both down:
//   - the cleanup threshold must be DERIVED from CACHE_VERSION (no
//     second literal);
//   - SHELL must cover every script the page actually loads, so a
//     fresh install is offline-capable.
//
// Pure static analysis — node:fs + regex, no jsdom, no service-worker
// runtime needed.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { stripJsComments } from './helpers/strip-js-comments.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = pathResolve(__dirname, '../..');
const swRaw = readFileSync(pathResolve(ROOT, 'sw.js'), 'utf8');
const indexHtml = readFileSync(pathResolve(ROOT, 'index.html'), 'utf8');

// Assertions below look at CODE only — sw.js's explanatory prose
// legitimately mentions the old `caches.match(...)` form and the old
// hardcoded threshold, and a naive regex stripper would either match
// that prose or (worse) swallow real code when a line comment
// contains `/*`.
const swSrc = stripJsComments(swRaw);

/**
 * Parse the `SHELL` array literal out of sw.js.
 *
 * @returns {string[]}
 */
function parseShell() {
  const start = swSrc.indexOf('const SHELL = [');
  if (start < 0) throw new Error('SHELL array not found in sw.js');
  const open = swSrc.indexOf('[', start);
  const close = swSrc.indexOf('];', open);
  if (close < 0) throw new Error('SHELL array did not close in sw.js');
  const body = swSrc.slice(open + 1, close);
  return Array.from(body.matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

/**
 * Every local script the page loads, as a root-relative path.
 * `?v=N` query strings are stripped — the version lives in the SW cache
 * bucket name, not in the URL.
 *
 * @returns {string[]}
 */
function pageScripts() {
  const out = new Set();
  for (const m of indexHtml.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    const src = m[1];
    if (!src.startsWith('/') && !src.startsWith('src/')) continue;
    out.add('/' + src.replace(/^\//, '').split('?')[0]);
  }
  return Array.from(out);
}

describe('sw.js — cache versioning', () => {
  it('derives CACHE from a single CACHE_VERSION constant', () => {
    expect(swSrc).toMatch(/const CACHE_VERSION = \d+;/);
    expect(swSrc).toMatch(/const CACHE = `buseta-v\$\{CACHE_VERSION\}`;/);
  });

  it('uses CACHE_VERSION for the cleanup threshold (no second literal)', () => {
    // The old code had `parseInt(m[1], 10) < 65` — a literal that had
    // to be bumped by hand and repeatedly drifted. It must now read
    // from CACHE_VERSION.
    const thresholds = Array.from(
      swSrc.matchAll(/parseInt\(m\[1\],\s*10\)\s*<\s*([A-Za-z0-9_]+)/g)
    ).map((m) => m[1]);
    expect(thresholds.length).toBeGreaterThan(0);
    for (const t of thresholds) {
      expect(t).toBe('CACHE_VERSION');
    }
  });

  it('does not hardcode a buseta-vN literal for the cache name', () => {
    // `const CACHE = 'buseta-v68'` would be the drift-prone form.
    expect(swSrc).not.toMatch(/const CACHE = 'buseta-v\d+';/);
  });
});

describe('sw.js — SHELL precache coverage', () => {
  const shell = parseShell();

  it('parses a non-empty SHELL list', () => {
    expect(shell.length).toBeGreaterThan(5);
  });

  it('covers the core app shell', () => {
    for (const entry of ['/', '/index.html', '/app.js', '/style.css', '/manifest.json']) {
      expect(shell).toContain(entry);
    }
  });

  it('covers every src/utils module the page loads', () => {
    const utilScripts = pageScripts().filter((p) => p.startsWith('/src/utils/'));
    expect(utilScripts.length).toBeGreaterThan(10);
    const missing = utilScripts.filter((p) => !shell.includes(p));
    expect(missing).toEqual([]);
  });

  it('covers every locally-loaded script the page references', () => {
    // `src/utils/*.js` only — app.js / planner.js are handled by the
    // same-origin cache branch, and planner.js is lazy-loaded on
    // demand (not part of the first-paint shell).
    const scripts = pageScripts().filter((p) => p.startsWith('/src/utils/'));
    const missing = scripts.filter((p) => !shell.includes(p));
    expect(missing).toEqual([]);
  });

  it('stores shell entries without a ?v= query string', () => {
    // The SW matches with ignoreSearch:true, so a stored query string
    // would be redundant — and the version belongs in the bucket name.
    for (const entry of shell) {
      expect(entry).not.toContain('?');
    }
  });
});

describe('sw.js — same-origin cache lookups', () => {
  it('matches same-origin requests with ignoreSearch so versioned URLs hit the shell entries', () => {
    // The page requests `/app.js?v=67`; SHELL stores `/app.js`. Without
    // ignoreSearch the precached copy is unreachable.
    expect(swSrc).toMatch(/cache\.match\(req,\s*\{\s*ignoreSearch:\s*true\s*\}\)/);
  });

  it('scopes the same-origin and navigate lookups to the current cache bucket', () => {
    // A global `caches.match(...)` searches every bucket in creation
    // order, so a leaked stale bucket could answer for the current one.
    expect(swSrc).not.toMatch(/caches\.match\(/);
  });
});
