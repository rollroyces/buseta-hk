// Production-aware debug logger.
//
// By default, debugLog() is silent — production users see no console
// noise. The maintainer can enable debug output via DevTools:
//
//   window.busetaDebug = true;
//   location.reload();
//
// Future debug sites in app.js / planner.js should call
// busetaUtils.debugLog(...) instead of an inline
// `if (window.busetaDebug) console.log(...)` guard. This module is
// the single source of truth for the gate; tests in
// tests/unit/debug-log.test.js enforce the behavior.
//
// `window.busetaDebug === undefined` (default) → silent.
// `window.busetaDebug === true` → forward to console.log.
// `window.busetaDebug === false` or any other falsy value → silent.
//
// We use `typeof window !== 'undefined'` because the same module is
// imported by Node tests (where `window` doesn't exist) — Node tests
// verify the gate logic directly; the `window.busetaDebug` access
// is skipped in Node.
//
// Why a global flag (not a settings UI / localStorage)?
//   - Smallest surface that solves the problem.
//   - Zero-cost when off (V8 skips the typeof check).
//   - One DevTools command away when needed.
//   - No persistent state to confuse reviewers.
//
// Future: when more debug domains need different toggles, consider
// splitting into window.busetaDebugGeo, window.busetaDebugPlanner,
// etc. For now one flag is enough.

export function debugLog(...args) {
  if (typeof window !== 'undefined' && window.busetaDebug) {
    console.log(...args);
  }
}

// Default-export alias for the dual-export pattern used by every
// src/utils/ module: ESM exports for Vitest + globalThis.busetaUtils
// for in-browser classic-script callers. The IIFE in index.html
// loads this via <script src="src/utils/debug-log.js?v=1"></script>
// and the module assigns itself onto globalThis so app.js /
// planner.js can call `busetaUtils.debugLog(...)`.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    debugLog,
  });
}
