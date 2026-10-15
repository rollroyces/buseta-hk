#!/usr/bin/env node
/**
 * Check that every language block in app.js's `const STRINGS = {...}`
 * table has the same set of keys. Exits with code 1 (and a clear report)
 * if any block is missing or has extras — this catches accidental
 * language drift when a key is added to zh-Hant / en but not the
 * remaining languages (or vice versa).
 *
 * The same check is exercised by tests/unit/i18n-parity.test.js (Vitest);
 * this script is a lighter alternative for hooks and CI runners that
 * don't pull Vitest. Both share the same brace-tracked extractor so
 * the behaviour stays identical.
 *
 * Usage:  node scripts/check-i18n.js
 */

const fs = require('node:fs');
const path = require('node:path');

const APP_JS = path.resolve(__dirname, '..', 'app.js');

function loadStrings(filePath) {
  const txt = fs.readFileSync(filePath, 'utf8');
  const start = txt.indexOf('const STRINGS = {');
  if (start < 0) throw new Error('const STRINGS not found in ' + filePath);
  let depth = 0;
  let end = -1;
  for (let i = start; i < txt.length; i++) {
    const ch = txt[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error('STRINGS block did not close in ' + filePath);
  const block = txt.slice(start, end + 1);
  const code =
    block.replace(/^const STRINGS/, 'var STRINGS_DATA') + '\nmodule.exports = { STRINGS_DATA };\n';
  const os = require('node:os');
  const tmp = path.join(
    os.tmpdir(),
    `buseta-strings-${process.pid}-${Math.random().toString(36).slice(2)}.js`
  );
  fs.writeFileSync(tmp, code);
  try {
    const mod = require(tmp);
    return mod.STRINGS_DATA;
  } finally {
    fs.unlinkSync(tmp);
  }
}

function main() {
  let STRINGS;
  try {
    STRINGS = loadStrings(APP_JS);
  } catch (e) {
    console.error('Could not extract STRINGS from app.js:', e.message);
    process.exit(2);
  }

  const langs = Object.keys(STRINGS).sort();
  if (!langs.includes('zh-Hant') || !langs.includes('en') || !langs.includes('zh-Hans')) {
    console.error(
      'Missing one of the required language blocks. Expected zh-Hant + en + zh-Hans; got:',
      langs.join(', ')
    );
    process.exit(2);
  }

  const allKeys = new Set();
  for (const lang of langs) for (const k of Object.keys(STRINGS[lang])) allKeys.add(k);

  let failed = false;
  for (const lang of langs) {
    const langKeys = new Set(Object.keys(STRINGS[lang]));
    const missing = [...allKeys].filter((k) => !langKeys.has(k));
    const extra = [...langKeys].filter((k) => !allKeys.has(k));
    if (missing.length || extra.length) failed = true;
    const tag = missing.length || extra.length ? '✗' : '✓';
    console.log(`${tag} ${lang}: ${langKeys.size} keys`);
    if (missing.length) console.log(`    missing: ${missing.join(', ')}`);
    if (extra.length) console.log(`    extra:   ${extra.join(', ')}`);
  }

  if (failed) {
    console.error('\nSTRINGS table is out of sync across languages.');
    process.exit(1);
  }
  console.log(`\nAll ${langs.length} language blocks share ${allKeys.size} keys ✓`);
}

main();
