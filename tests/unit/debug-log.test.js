// @vitest-environment jsdom
//
// Tests for src/utils/debug-log.js — the production-aware debug
// logger extracted in Phase 33.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { debugLog } from '../../src/utils/debug-log.js';

describe('src/utils/debug-log.js', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Reset the flag before each test so they don't bleed into each
    // other. delete (vs setting to undefined) makes the property
    // actually missing — closer to the production default state.
    delete window.busetaDebug;
  });

  afterEach(() => {
    logSpy.mockRestore();
    delete window.busetaDebug;
  });

  describe('gate behavior', () => {
    it('does not log when window.busetaDebug is undefined (production default)', () => {
      debugLog('hello', 'world');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('logs when window.busetaDebug === true', () => {
      window.busetaDebug = true;
      debugLog('hello', 'world');
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith('hello', 'world');
    });

    it('does not log when window.busetaDebug === false', () => {
      window.busetaDebug = false;
      debugLog('should not appear');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('does not log when window.busetaDebug is any other falsy value (null, 0, "")', () => {
      for (const falsy of [null, 0, '', undefined, NaN]) {
        window.busetaDebug = falsy;
        debugLog(`with ${falsy}`);
        expect(logSpy).not.toHaveBeenCalled();
        logSpy.mockClear();
      }
    });

    it('logs every truthy value (1, "yes", {} from non-empty object)', () => {
      for (const truthy of [1, 'yes', {}, []]) {
        window.busetaDebug = truthy;
        debugLog('called with truthy', truthy);
        expect(logSpy).toHaveBeenCalledTimes(1);
        logSpy.mockClear();
      }
    });
  });

  describe('argument forwarding', () => {
    it('forwards no args (no-op call)', () => {
      window.busetaDebug = true;
      debugLog();
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith();
    });

    it('forwards many args of mixed types', () => {
      window.busetaDebug = true;
      const obj = { a: 1 };
      const arr = [2, 3];
      debugLog('label', 42, obj, arr, null);
      expect(logSpy).toHaveBeenCalledWith('label', 42, obj, arr, null);
    });

    it('preserves the order and identity of object args', () => {
      window.busetaDebug = true;
      const obj = { deeply: { nested: 'value' } };
      debugLog(obj);
      const calledWith = logSpy.mock.calls[0][0];
      expect(calledWith).toBe(obj); // same reference
      expect(calledWith.deeply.nested).toBe('value');
    });
  });

  describe('dual-export pattern', () => {
    it('attaches itself to globalThis.busetaUtils', () => {
      // The module side-effect must run on import — every src/utils/
      // module does this for the in-browser classic-script path
      // (window.__buseta.loadPlannerScript etc. use the same
      // pattern). This is what app.js / planner.js rely on.
      expect(typeof globalThis.busetaUtils.debugLog).toBe('function');
      // The function exposed on globalThis is the same function as
      // the named export (so call sites using `busetaUtils.debugLog`
      // get the same gate behavior).
      expect(globalThis.busetaUtils.debugLog).toBe(debugLog);
    });

    it('is idempotent on multiple loads', () => {
      // Calling Object.assign twice with the same key just overwrites
      // — no duplicated methods. Some test runners import modules
      // multiple times in weird ways; this guards against that.
      const before = globalThis.busetaUtils.debugLog;
      // Re-import would only re-run if the module is cached and the
      // side-effect runs. Force it by re-importing.
      return import('../../src/utils/debug-log.js').then((mod) => {
        expect(globalThis.busetaUtils.debugLog).toBe(before);
        expect(globalThis.busetaUtils.debugLog).toBe(mod.debugLog);
      });
    });
  });
});
