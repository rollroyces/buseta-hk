// ESLint 9 flat config.
//
// Scope: keep `npm run lint` enforcing on the files we *control* (pure
// helpers + tests + build scripts), and *not* on the legacy monolith
// (`app.js`, `planner.js`, `sw.js`). The monolith has accumulated
// patterns a stricter config would flag; cleaning those up is a
// dedicated refactor task, not a config PR.
//
// To extend coverage later, add the file pattern to the `files` glob
// in the relevant `configs` block below.

import js from '@eslint/js';
import globals from 'globals';

export default [
  // 1. Project-wide ignores. Keep this short — every entry here is a
  // file that's not lint-checked. Add a comment if you add a new glob.
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'assets/**', // generated data files (fares, stops, lines, …)
      '*.min.js',
      '*.min.css',
      'package-lock.json',
      // The monolith (app.js, planner.js, sw.js) is intentionally
      // excluded from lint enforcement — those files use the browser's
      // `window`, `document`, `localStorage`, `caches`, etc. as free
      // references without going through an IIFE, and the legacy
      // patterns a stricter config would flag (e.g. duplicate keys,
      // unused vars) are out of scope for this config PR. A future
      // refactor PR can migrate them to a stricter shape and remove
      // these three entries.
      'app.js',
      'planner.js',
      'sw.js',
    ],
  },

  // 2. Base config — applies to every linted file. The `js.configs.recommended`
  // preset gives us a sane baseline: no-unused-vars, no-undef,
  // prefer-const, no-var, eqeqeq, curly, no-empty, …
  js.configs.recommended,

  // 3. src/utils/*.js — pure helpers. Strictest of the three blocks.
  {
    files: ['src/utils/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // BusETA convention — every src/utils/ module attaches itself
        // to globalThis so in-browser classic-script callers can use
        // `busetaUtils.foo()` without an import.
        busetaUtils: 'readonly',
      },
    },
    rules: {
      // Don't punish the dual-export pattern (`export …` + globalThis
      // attach). The exports are real ESM exports; the globalThis
      // assignment is a side-effect for the IIFE that loads the
      // <script> tag in index.html. eslint-disable-next-line comments
      // make each side explicit at the call site.
      //
      // `caughtErrorsIgnorePattern: '^_'` lets `catch (_)` blocks stand
      // without disabling no-unused-vars globally — a common pattern
      // when a try/catch is for resilience (older browser quirks, etc.)
      // and the error object is intentionally ignored.
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // 4. tests/unit/*.js — tests run under Vitest, which provides
  // describe/it/expect as globals; jsdom provides the browser DOM.
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // Vitest globals (in case jsconfig doesn't enable it).
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        // Node-specific helpers used by tests that load STRINGS from
        // app.js (tests/unit/i18n-parity.test.js, tests/unit/cache-buster.test.js).
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      // Tests may use console.log for debugging during development.
      'no-console': 'off',
      // Tests may legitimately use let for mutation / loops.
      'prefer-const': 'off',
    },
  },

  // 5. scripts/*.js — Node CLI scripts (check-i18n.js, future helpers).
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
  },
];
