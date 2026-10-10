import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Loads the STRINGS table from app.js by reading the file as text and
// evaluating just the `const STRINGS = { ... };` chunk in an isolated
// Node module. The rest of app.js is wrapped in an IIFE that expects
// browser globals, so we can't `require()` the file directly.
function loadStrings() {
  const appJsPath = pathResolve(__dirname, '../../app.js');
  const txt = readFileSync(appJsPath, 'utf8');
  const start = txt.indexOf('const STRINGS = {');
  if (start < 0) throw new Error('const STRINGS not found in app.js');
  // Brace-track the matching close.
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
  if (end < 0) throw new Error('STRINGS block did not close');
  const block = txt.slice(start, end + 1);
  // Rename `const STRINGS` to `var STRINGS_DATA` so we can require() it.
  const code =
    block.replace(/^const STRINGS/, 'var STRINGS_DATA') + '\nmodule.exports = { STRINGS_DATA };\n';
  // Use a data: URL or a tmp file — Node's module loader accepts a
  // file path. We use a tmp file so stack traces stay readable.
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const tmp = path.join(
    os.tmpdir(),
    `buseta-strings-${process.pid}-${Math.random().toString(36).slice(2)}.js`
  );
  fs.writeFileSync(tmp, code);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(tmp);
    return mod.STRINGS_DATA;
  } finally {
    fs.unlinkSync(tmp);
  }
}

// Extracts the planner-only string keys from planner.js by scanning
// every `ensure('zh-Hant', '<key>', ...)` call. Returns the unique
// sorted set of keys. Catches two failure modes:
//   1. A key is patched for zh-Hant / en but not for zh-Hans (parity
//      drift across the three languages).
//   2. A key is patched only in one or two languages (forgotten
//      language block).
function loadPlannerPatchedKeys() {
  const plannerPath = pathResolve(__dirname, '../../planner.js');
  const txt = readFileSync(plannerPath, 'utf8');
  // Match `ensure('<lang>', '<key>', ...)` calls. Three per key.
  const re = /ensure\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,/g;
  const perKeyLangs = new Map();
  let m;
  while ((m = re.exec(txt)) !== null) {
    const [, lang, key] = m;
    if (!perKeyLangs.has(key)) perKeyLangs.set(key, new Set());
    perKeyLangs.get(key).add(lang);
  }
  return perKeyLangs; // Map<key, Set<lang>>
}

describe('STRINGS — i18n parity across languages', () => {
  const STRINGS = loadStrings();

  it('has all three language blocks (zh-Hant, en, zh-Hans)', () => {
    expect(Object.keys(STRINGS).sort()).toEqual(['en', 'zh-Hans', 'zh-Hant']);
  });

  it('zh-Hant block exists and is non-empty', () => {
    expect(STRINGS['zh-Hant']).toBeDefined();
    expect(Object.keys(STRINGS['zh-Hant']).length).toBeGreaterThan(100);
  });

  it('en block exists and is non-empty', () => {
    expect(STRINGS['en']).toBeDefined();
    expect(Object.keys(STRINGS['en']).length).toBeGreaterThan(100);
  });

  it('zh-Hans block exists and is non-empty', () => {
    expect(STRINGS['zh-Hans']).toBeDefined();
    expect(Object.keys(STRINGS['zh-Hans']).length).toBeGreaterThan(100);
  });

  it('every key present in zh-Hant is also present in en and zh-Hans', () => {
    const zhHantKeys = new Set(Object.keys(STRINGS['zh-Hant']));
    const enKeys = new Set(Object.keys(STRINGS['en']));
    const zhHansKeys = new Set(Object.keys(STRINGS['zh-Hans']));
    const allKeys = new Set([...zhHantKeys, ...enKeys, ...zhHansKeys]);

    const missingFromEn = [...allKeys].filter((k) => !enKeys.has(k));
    const missingFromZhHans = [...allKeys].filter((k) => !zhHansKeys.has(k));
    const missingFromZhHant = [...allKeys].filter((k) => !zhHantKeys.has(k));

    expect(missingFromEn).toEqual([]);
    expect(missingFromZhHans).toEqual([]);
    expect(missingFromZhHant).toEqual([]);
  });

  it('the three language blocks have the same key count', () => {
    expect(Object.keys(STRINGS['zh-Hant']).length).toBe(Object.keys(STRINGS['en']).length);
    expect(Object.keys(STRINGS['zh-Hant']).length).toBe(Object.keys(STRINGS['zh-Hans']).length);
  });

  it('every string value is non-empty (no empty translations)', () => {
    for (const lang of ['zh-Hant', 'en', 'zh-Hans']) {
      for (const [key, val] of Object.entries(STRINGS[lang])) {
        // Function-valued entries (e.g. `(n) => ...`) are allowed.
        if (typeof val === 'function') continue;
        expect(typeof val, `STRINGS.${lang}.${key} should be a string`).toBe('string');
        expect(val.length, `STRINGS.${lang}.${key} should not be empty`).toBeGreaterThan(0);
      }
    }
  });
});

describe('planner.js patchPlannerStrings — covers all three languages per key', () => {
  const perKey = loadPlannerPatchedKeys();

  it('planner.js patches at least one planner-only key', () => {
    expect(perKey.size).toBeGreaterThan(0);
  });

  it('every planner-patched key is patched in all three languages', () => {
    const expectedLangs = new Set(['zh-Hant', 'en', 'zh-Hans']);
    const offenders = [];
    for (const [key, langs] of perKey.entries()) {
      const missing = [...expectedLangs].filter((l) => !langs.has(l));
      if (missing.length) offenders.push(`${key} → missing ${missing.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('planner-patched keys are unique (no duplicate `ensure` calls for the same key+lang)', () => {
    // The regex already dedupes per-key by collapsing into a Set; this
    // test exists so a future refactor that introduces per-key dup
    // calls (e.g. two zh-Hant patches) fails explicitly rather than
    // silently shadowing the earlier value.
    const plannerPath = pathResolve(__dirname, '../../planner.js');
    const txt = readFileSync(plannerPath, 'utf8');
    const re = /ensure\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,/g;
    const seen = new Set();
    const dupes = [];
    let m;
    while ((m = re.exec(txt)) !== null) {
      const tuple = `${m[1]}|${m[2]}`;
      if (seen.has(tuple)) dupes.push(tuple);
      seen.add(tuple);
    }
    expect(dupes).toEqual([]);
  });
});
