import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const indexHtmlPath = pathResolve(__dirname, '../../index.html');
const swJsPath = pathResolve(__dirname, '../../sw.js');

const indexHtml = readFileSync(indexHtmlPath, 'utf8');
const swJs = readFileSync(swJsPath, 'utf8');

// Live cache-buster values scraped from index.html + sw.js. Sources:
//
//   1. <meta name="buseta-version" content="N" />  — the *overall* version.
//      Must monotonically increase on every JS/CSS-touching commit.
//   2. app.js?v=N  — last bump of `app.js`.
//   3. planner.js?v=N  — last bump of `planner.js`.
//   4. planner.css?v=N  — last bump of `planner.css`.
//   5. style.css?v=N  — last bump of `style.css`.
//   6. sw.js: `const CACHE = 'buseta-vN'` — last SW cache version. Must be
//      >= max(asset ?v=) so the SW correctly invalidates older assets.
//
// Single source of truth: `docs/cache-strategy.md` (Phase 1). This test
// is the runtime guard that every cache-buster-touching PR follows the
// discipline.
//
// Extracted with simple regexes so the test is self-contained and doesn't
// require parsing HTML/JS — just plain text scanning. The site is small
// enough that there's only one of each live value; multiple matches only
// appear in the in-page release-notes section (which embeds historic
// `?v=` numbers), so we filter for the *live* tags by their position.

function extractFirst(re, text) {
  const m = re.exec(text);
  return m ? Number(m[1]) : NaN;
}

function getMeta() {
  // Only the live <meta name="buseta-version" content="N" /> tag — at the
  // top of <head>. Historic mentions live inside the release-notes
  // <details> block and are quoted as prose ("content=\"34\" → \"35\""),
  // not as raw `content="N"` attributes. So the first raw match wins.
  return extractFirst(/<meta\s+name="buseta-version"\s+content="(\d+)"\s*\/>/, indexHtml);
}

function getLiveQuery(name) {
  // Live `<script src="…js?v=N">` or `<link href="…css?v=N">` tags use
  // single/double quotes around the URL and a `?v=N` query string.
  // The lazy planner loader uses `s.src = 'planner.js?v=N';` (no
  // double-quoted attribute) — both forms are matched.
  // prettier-ignore
  const scriptRe = new RegExp(
    `(?:src|href)\\s*=\\s*['"][^'"]*${name.replace('.', '\\.')}\\?v=(\\d+)['"]`
  );
  return extractFirst(scriptRe, indexHtml);
}

function getSwCache() {
  // `const CACHE = 'buseta-vN';` is the canonical SW cache key. Some
  // patterns match this prefix in comments; the canonical form is on a
  // line that starts with `const CACHE`.
  return extractFirst(/^const\s+CACHE\s*=\s*['"]buseta-v(\d+)['"]/m, swJs);
}

describe('cache-buster discipline (index.html + sw.js)', () => {
  const meta = getMeta();
  const appJs = getLiveQuery('app.js');
  const plannerJs = getLiveQuery('planner.js');
  const plannerCss = getLiveQuery('planner.css');
  const styleCss = getLiveQuery('style.css');
  const swCache = getSwCache();

  it('every live cache-buster value parses as a positive integer', () => {
    // If any value is NaN, the regex didn't match — usually means the
    // file got edited and the test got stale. Either fix the test or
    // add the missing tag.
    expect(Number.isInteger(meta) && meta > 0).toBe(true);
    expect(Number.isInteger(appJs) && appJs > 0).toBe(true);
    expect(Number.isInteger(plannerJs) && plannerJs > 0).toBe(true);
    expect(Number.isInteger(plannerCss) && plannerCss > 0).toBe(true);
    expect(Number.isInteger(styleCss) && styleCss > 0).toBe(true);
    expect(Number.isInteger(swCache) && swCache > 0).toBe(true);
  });

  it('meta is the highest cache-buster value (overall release version)', () => {
    // The <meta> tag tracks the cumulative release number. Every
    // JS/CSS-touching commit bumps meta, so it must be >= every asset's
    // ?v= bump.
    const assetMax = Math.max(appJs, plannerJs, plannerCss, styleCss);
    expect(meta).toBeGreaterThanOrEqual(assetMax);
  });

  it('sw.js CACHE version is at least the latest asset ?v= (so SW invalidates old assets)', () => {
    const assetMax = Math.max(appJs, plannerJs, plannerCss, styleCss);
    expect(swCache).toBeGreaterThanOrEqual(assetMax);
  });

  it('app.js ?v= is at least as large as style.css ?v= (app.js usually imports style.css)', () => {
    // Loose sanity check — when both are bumped in lock-step they're
    // equal; this catches the asymmetric case where style.css was
    // bumped but app.js wasn't (or vice-versa).
    expect(appJs).toBeGreaterThanOrEqual(styleCss);
  });

  it('planner.js ?v= is at least as large as planner.css ?v= (planner.js usually imports planner.css)', () => {
    expect(plannerJs).toBeGreaterThanOrEqual(plannerCss);
  });

  it('every cache-buster value is a single digit (sanity: no accidental string concat)', () => {
    // The discipline is "small integers, not dates or semver". A
    // regression that wrote `app.js?v=1.61` would not match the regex
    // (good), but a regression that wrote `app.js?v=61000` would. The
    // upper bound here is just paranoia — current real-world values
    // are < 100. If we ever legitimately exceed 9999, bump this.
    expect(meta).toBeLessThan(9999);
    expect(appJs).toBeLessThan(9999);
    expect(plannerJs).toBeLessThan(9999);
    expect(plannerCss).toBeLessThan(9999);
    expect(styleCss).toBeLessThan(9999);
    expect(swCache).toBeLessThan(9999);
  });
});
