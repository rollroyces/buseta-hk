// Wiring-parity test for the `src/utils/` classic-script modules.
//
// Background
// ----------
// Every module in `src/utils/` is loaded TWICE:
//
//   1. as an ES module, so Vitest can `import { x } from '../../src/utils/x.js'`;
//   2. as a classic `<script src="src/utils/x.js?v=1">` in `index.html`, which
//      attaches the same helpers to `globalThis.busetaUtils` so the
//      no-build-step `app.js` / `planner.js` monoliths can call them.
//
// Step 2 is easy to forget. In Phase 41 the keyboard-shortcut dispatcher was
// written, wired into `app.js`, given 31 passing unit tests — and then
// shipped DEAD, because `index.html` never got the `<script>` tag. The
// boot code bailed silently:
//
//     if (typeof busetaUtils.createKeyboardDispatcher !== 'function') return;
//
// Every test passed; the feature did not exist in the browser. This test
// makes that class of regression impossible.
//
// What it asserts
// ---------------
//   1. Every `busetaUtils.<name>` referenced from `app.js` / `planner.js`
//      is exported by SOME module in `src/utils/` (catches a rename that
//      missed the dual-export list).
//   2. Every module that exports a referenced name is actually loaded by
//      `index.html` via a `<script src="src/utils/<file>">` tag (catches
//      the "wrote the helper, forgot the tag" bug).
//
// Pure static analysis — `node:fs` + regex, no jsdom needed. Same
// technique as `tests/unit/cache-buster.test.js`.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { stripJsComments } from './helpers/strip-js-comments.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = pathResolve(__dirname, '../..');
const UTILS_DIR = pathResolve(ROOT, 'src/utils');

/**
 * Strip JS comments so a commented-out `busetaUtils.foo` reference doesn't
 * count as a live dependency. Uses the shared character-scanner helper
 * (a naive block-comment regex mis-fires when a line comment contains
 * `/*`, e.g. `src/utils/*.js`).
 *
 * @param {string} src
 * @returns {string}
 */
function stripComments(src) {
  return stripJsComments(src);
}

/**
 * Collect the names a `src/utils/*.js` module publishes on
 * `globalThis.busetaUtils`.
 *
 * Two sources, because not every module follows the identical shape:
 *   - the `Object.assign(globalThis.busetaUtils || {}, { a, b, c })` list
 *     that implements the dual-export pattern;
 *   - `export function` / `export const` declarations, which are the
 *     authoritative ES-module surface even if a module forgot to list a
 *     name in its `Object.assign` block.
 *
 * @param {string} src
 * @returns {Set<string>}
 */
export function exportedNames(src) {
  const names = new Set();

  const assignRe =
    /Object\.assign\(\s*globalThis\.busetaUtils\s*\|\|\s*\{\s*\}\s*,\s*\{([\s\S]*?)\}\s*\)/g;
  let m;
  while ((m = assignRe.exec(src)) !== null) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(':')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }

  const declRe = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = declRe.exec(src)) !== null) names.add(m[1]);

  return names;
}

/**
 * Every `busetaUtils.<name>` referenced from the given source files.
 *
 * @param {string[]} files - absolute paths
 * @returns {Map<string, string[]>} name -> list of files that reference it
 */
export function referencedUtils(files) {
  const refs = new Map();
  for (const file of files) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const re = /\bbusetaUtils\.([A-Za-z_$][\w$]*)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const name = m[1];
      if (!refs.has(name)) refs.set(name, []);
      refs.get(name).push(file);
    }
  }
  return refs;
}

describe('src/utils — wiring parity between app.js / planner.js and index.html', () => {
  const utilFiles = readdirSync(UTILS_DIR)
    .filter((f) => f.endsWith('.js'))
    .map((f) => pathResolve(UTILS_DIR, f));

  const indexHtml = readFileSync(pathResolve(ROOT, 'index.html'), 'utf8');
  const monoliths = [pathResolve(ROOT, 'app.js'), pathResolve(ROOT, 'planner.js')];

  // name -> the module file that exports it
  const nameToModule = new Map();
  for (const file of utilFiles) {
    for (const name of exportedNames(readFileSync(file, 'utf8'))) {
      if (!nameToModule.has(name)) nameToModule.set(name, file);
    }
  }

  it('every src/utils module exists on disk', () => {
    expect(utilFiles.length).toBeGreaterThan(10);
  });

  it('every busetaUtils.* referenced from app.js / planner.js is exported by a module', () => {
    const refs = referencedUtils(monoliths);
    const orphans = [];
    for (const [name, files] of refs) {
      if (!nameToModule.has(name)) {
        orphans.push(`${name} (referenced in ${files.map((f) => f.split('/').pop()).join(', ')})`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it('every module backing a referenced busetaUtils.* is loaded by index.html', () => {
    const refs = referencedUtils(monoliths);
    const missing = [];
    for (const [name] of refs) {
      const moduleFile = nameToModule.get(name);
      if (!moduleFile) continue; // covered by the previous test
      const rel = `src/utils/${moduleFile.split('/').pop()}`;
      // The tag must be present AND point at this exact file.
      if (!indexHtml.includes(`src="${rel}`)) {
        missing.push(`${name} -> ${rel} (never loaded in index.html)`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every src/utils/*.js file is either loaded by index.html or explicitly marked unused', () => {
    // A module can legitimately ship un-loaded (e.g. a pure helper that
    // nothing calls yet). But an un-loaded module that IS referenced is
    // caught above — this test just reports the rest so the set doesn't
    // silently grow.
    const unloaded = utilFiles
      .map((f) => `src/utils/${f.split('/').pop()}`)
      .filter((rel) => !indexHtml.includes(`src="${rel}`));
    // We expect this list to stay empty (every module is wired).
    expect(unloaded).toEqual([]);
  });
});
