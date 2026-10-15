#!/usr/bin/env node
/**
 * Check that the six cache-buster knobs in index.html + sw.js stay
 * coherent — same invariants as tests/unit/cache-buster.test.js
 * (Vitest), but as a standalone Node CLI for hooks and CI runners that
 * don't pull Vitest.
 *
 * The six knobs:
 *
 *   1. <meta name="buseta-version" content="N">           in index.html
 *   2. <script src="app.js?v=N">                         in index.html
 *   3. <script src="planner.js?v=N">                     in index.html
 *      (lazy-loaded: `s.src = 'planner.js?v=N';`)
 *   4. <link href="planner.css?v=N">                     in index.html
 *      (lazy-loaded: `l.href = 'planner.css?v=N';`)
 *   5. <link href="style.css?v=N">                       in index.html
 *   6. sw.js: `const CACHE = 'buseta-vN'`                in sw.js
 *
 * Invariants enforced (same as the Vitest test):
 *
 *   I1.  Every value parses as a positive integer.
 *   I2.  meta >= max(app.js?v, planner.js?v, planner.css?v, style.css?v).
 *   I3.  sw.js CACHE >= max(asset ?v=).
 *   I4.  app.js?v >= style.css?v.
 *   I5.  planner.js?v >= planner.css?v.
 *   I6.  Every value < 9999.
 *
 * Exit code 0 if all invariants pass, 1 otherwise. Each failing
 * invariant is reported on its own line so CI logs and pre-commit
 * output both stay readable.
 *
 * Usage:  node scripts/check-cache-buster.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');
const SW_JS = path.join(ROOT, 'sw.js');

// --- Extractors (mirror tests/unit/cache-buster.test.js exactly) -------

function extractFirst(re, text) {
  const m = re.exec(text);
  return m ? Number(m[1]) : NaN;
}

function getMeta(indexHtml) {
  return extractFirst(/<meta\s+name="buseta-version"\s+content="(\d+)"\s*\/>/, indexHtml);
}

function getLiveQuery(name, indexHtml) {
  // Matches both `src="…?v=N"` / `href="…?v=N"` (live tags) and
  // `s.src = '…?v=N'` / `l.href = '…?v=N'` (the lazy planner loader
  // that lives in an inline <script> in index.html).
  const scriptRe = new RegExp(
    `(?:src|href)\\s*=\\s*['"][^'"]*${name.replace('.', '\\.')}\\?v=(\\d+)['"]`
  );
  return extractFirst(scriptRe, indexHtml);
}

function getSwCache(swJs) {
  return extractFirst(/^const\s+CACHE\s*=\s*['"]buseta-v(\d+)['"]/m, swJs);
}

// --- Report helpers -----------------------------------------------------

const FAILURES = [];
function fail(msg) {
  FAILURES.push(msg);
  console.error(`  ✗ ${msg}`);
}
function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

// --- Run ----------------------------------------------------------------

const indexHtml = fs.readFileSync(INDEX_HTML, 'utf8');
const swJs = fs.readFileSync(SW_JS, 'utf8');

const meta = getMeta(indexHtml);
const appJs = getLiveQuery('app.js', indexHtml);
const plannerJs = getLiveQuery('planner.js', indexHtml);
const plannerCss = getLiveQuery('planner.css', indexHtml);
const styleCss = getLiveQuery('style.css', indexHtml);
const swCache = getSwCache(swJs);

console.log('Cache-buster values scraped:');
console.log(`  meta              = ${meta}`);
console.log(`  app.js?v          = ${appJs}`);
console.log(`  planner.js?v      = ${plannerJs}`);
console.log(`  planner.css?v     = ${plannerCss}`);
console.log(`  style.css?v       = ${styleCss}`);
console.log(`  sw.js CACHE       = ${swCache}  (buseta-v${swCache})`);
console.log('');

// I1 — every value is a positive integer
const allValues = { meta, appJs, plannerJs, plannerCss, styleCss, swCache };
let i1Failed = false;
for (const [name, value] of Object.entries(allValues)) {
  if (!Number.isInteger(value) || value <= 0) {
    fail(`I1: ${name} = ${value} is not a positive integer`);
    i1Failed = true;
  }
}
if (!i1Failed) ok('I1: every cache-buster value is a positive integer');

// I2 — meta >= max(asset ?v=)
const assetMax = Math.max(appJs, plannerJs, plannerCss, styleCss);
if (Number.isFinite(meta) && meta >= assetMax) {
  ok(`I2: meta (${meta}) >= max(asset ?v=) (${assetMax})`);
} else {
  fail(`I2: meta (${meta}) < max(asset ?v=) (${assetMax})`);
}

// I3 — sw.js CACHE >= max(asset ?v=)
if (Number.isFinite(swCache) && swCache >= assetMax) {
  ok(`I3: sw.js CACHE (${swCache}) >= max(asset ?v=) (${assetMax})`);
} else {
  fail(`I3: sw.js CACHE (${swCache}) < max(asset ?v=) (${assetMax})`);
}

// I4 — app.js?v >= style.css?v
if (Number.isFinite(appJs) && Number.isFinite(styleCss) && appJs >= styleCss) {
  ok(`I4: app.js?v (${appJs}) >= style.css?v (${styleCss})`);
} else {
  fail(
    `I4: app.js?v (${appJs}) < style.css?v (${styleCss}) — bumped stylesheet without bumping app.js?`
  );
}

// I5 — planner.js?v >= planner.css?v
if (Number.isFinite(plannerJs) && Number.isFinite(plannerCss) && plannerJs >= plannerCss) {
  ok(`I5: planner.js?v (${plannerJs}) >= planner.css?v (${plannerCss})`);
} else {
  fail(
    `I5: planner.js?v (${plannerJs}) < planner.css?v (${plannerCss}) — bumped stylesheet without bumping planner.js?`
  );
}

// I6 — every value < 9999
let i6Failed = false;
for (const [name, value] of Object.entries(allValues)) {
  if (Number.isFinite(value) && value >= 9999) {
    fail(`I6: ${name} = ${value} >= 9999 (typo guard)`);
    i6Failed = true;
  }
}
if (!i6Failed) ok('I6: every cache-buster value < 9999');

// --- Exit ----------------------------------------------------------------

if (FAILURES.length > 0) {
  console.error('');
  console.error(`${FAILURES.length} invariant(s) failed.`);
  process.exit(1);
}

console.log('');
console.log('All cache-buster invariants hold.');
process.exit(0);
