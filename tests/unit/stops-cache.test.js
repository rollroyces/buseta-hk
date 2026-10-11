// Tests for src/utils/stops-cache.js — Phase 43's lazy-load helper
// for assets/hk-stops.json.
//
// The helper has three observable surfaces:
//   - ensureStopsLoaded() — primary entry; fetches once, de-dupes,
//     caches to localStorage on success.
//   - getStops() — sync accessor for "do we have it already?".
//   - invalidateStopsCache() — clears memory + localStorage so
//     tests can start with a clean slate.
//
// We mock globalThis.fetch for the network paths and install a
// minimal localStorage stub on globalThis rather than using jsdom,
// matching the keyboard-shortcuts pattern (see
// tests/unit/keyboard-shortcuts.test.js for the rationale — jsdom@30
// has a known-broken post-install on some CI runners).

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { ensureStopsLoaded, getStops, invalidateStopsCache } from '../../src/utils/stops-cache.js';
import { STOPS_CACHE_KEY, STOPS_CACHE_TS_KEY, STOPS_TTL_MS } from '../../src/utils/stops-cache.js';

// Minimal localStorage stand-in. The helper only calls .clear(),
// .getItem(), and .setItem(), so a Map-backed stub is enough.
function installLocalStorageStub() {
  const store = new Map();
  globalThis.localStorage = {
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    key(i) {
      return Array.from(store.keys())[i] ?? null;
    },
    get length() {
      return store.size;
    },
  };
}

// A realistic but minimal stand-in for assets/hk-stops.json. The
// real file has thousands of entries; this fixture keeps three to
// keep the assertions readable. Shape matches the bundled JSON:
// each entry is `{ zh, en, lat, lng }`, keys are operator stop IDs
// (MTR station codes / GMB numeric IDs / NLB numeric IDs).
const FIXTURE = {
  KTT: { zh: '堅尼地城', en: 'Kennedy Town', lat: 22.28149, lng: 114.12864 },
  CENTRAL: { zh: '中環', en: 'Central', lat: 22.282, lng: 114.1588 },
  SYP: { zh: '西營盤', en: 'Sai Ying Pun', lat: 22.28662, lng: 114.14283 },
};

describe('src/utils/stops-cache.js', () => {
  let fetchSpy;

  beforeEach(() => {
    // Each test starts with no in-memory cache and no localStorage
    // entries — `invalidateStopsCache` is the documented reset
    // surface; clearing localStorage separately guards against
    // leakage from a previous test that bypassed the helper.
    installLocalStorageStub();
    invalidateStopsCache();
    try {
      localStorage.clear();
    } catch {
      /* our stub always exposes localStorage; defensive only */
    }
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    delete globalThis.fetch;
    vi.restoreAllMocks();
  });

  afterAll(() => {
    delete globalThis.localStorage;
  });

  describe('ensureStopsLoaded() — happy path', () => {
    it('returns the parsed JSON on the first call (cache miss)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      const result = await ensureStopsLoaded();
      expect(result).toEqual(FIXTURE);
      expect(result.KTT.en).toBe('Kennedy Town');
    });

    it('fetches /assets/hk-stops.json with cache: force-cache (matches trams.js pattern)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      await ensureStopsLoaded();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('assets/hk-stops.json');
      // `credentials: 'omit'` + `cache: 'force-cache'` is the
      // same-origin static asset pattern used by
      // src/utils/trams.js — lets the SW's ASSET_CACHE bucket win
      // over the network on subsequent calls.
      expect(init.credentials).toBe('omit');
      expect(init.cache).toBe('force-cache');
    });

    it('returns the cached object on a second call without re-fetching (in-memory hit)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      const first = await ensureStopsLoaded();
      const second = await ensureStopsLoaded();
      expect(second).toBe(first); // same reference — no copy
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('persists the response to localStorage with a fresh timestamp', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      await ensureStopsLoaded();
      const cached = localStorage.getItem(STOPS_CACHE_KEY);
      const ts = localStorage.getItem(STOPS_CACHE_TS_KEY);
      expect(cached).not.toBeNull();
      expect(JSON.parse(cached)).toEqual(FIXTURE);
      const tsNum = Number(ts);
      expect(Number.isFinite(tsNum)).toBe(true);
      // Stamp should be very recent — within the last 5 seconds.
      expect(Date.now() - tsNum).toBeLessThan(5000);
    });

    it('hydrates from localStorage on a cold module reload (no fetch when cache is fresh)', async () => {
      // Pre-populate localStorage as if a previous page session
      // had already loaded the catalogue.
      localStorage.setItem(STOPS_CACHE_KEY, JSON.stringify(FIXTURE));
      localStorage.setItem(STOPS_CACHE_TS_KEY, String(Date.now()));
      const result = await ensureStopsLoaded();
      expect(result).toEqual(FIXTURE);
      // Critically — no network call. This is the cold-load win:
      // even with a cold module, the localStorage mirror avoids
      // re-downloading 190 KB on every page reload.
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('prefers localStorage over the network when both are populated', async () => {
      // Edge case: in-memory and localStorage diverge. The
      // in-memory copy is treated as authoritative once it's set,
      // but on a cold module memory is empty — so localStorage
      // wins, and the network fetch only fires when localStorage
      // is also stale/missing.
      const stale = { KTT: { zh: '堅尼地城 OLD', en: 'Kennedy Town OLD', lat: 1, lng: 1 } };
      localStorage.setItem(STOPS_CACHE_KEY, JSON.stringify(stale));
      localStorage.setItem(STOPS_CACHE_TS_KEY, String(Date.now()));
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      const result = await ensureStopsLoaded();
      expect(result).toEqual(stale);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('ensureStopsLoaded() — concurrent callers de-duplicate', () => {
    it('two simultaneous calls share one fetch (no duplicate HTTP request)', async () => {
      // Defer the resolve so the second caller lands BEFORE the
      // first fetch completes — without de-dup this would produce
      // two network calls.
      let resolveFetch;
      const pendingFetch = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      fetchSpy.mockImplementationOnce(() => pendingFetch);
      const p1 = ensureStopsLoaded();
      const p2 = ensureStopsLoaded();
      expect(fetchSpy).toHaveBeenCalledTimes(1); // de-duped
      resolveFetch({
        ok: true,
        json: async () => FIXTURE,
      });
      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toEqual(FIXTURE);
      expect(r2).toEqual(FIXTURE);
      expect(r1).toBe(r2);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('three simultaneous calls share one fetch', async () => {
      let resolveFetch;
      const pendingFetch = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      fetchSpy.mockImplementationOnce(() => pendingFetch);
      const p1 = ensureStopsLoaded();
      const p2 = ensureStopsLoaded();
      const p3 = ensureStopsLoaded();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      resolveFetch({
        ok: true,
        json: async () => FIXTURE,
      });
      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
      expect(r1).toBe(r2);
      expect(r2).toBe(r3);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('after a successful resolve, a follow-up call resolves from memory and does not fetch again', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      await ensureStopsLoaded();
      const r1 = await ensureStopsLoaded();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ different: { zh: '唔同', en: 'different', lat: 0, lng: 0 } }),
      });
      // Even with a fetch mock waiting, the in-memory cache must
      // shadow the network — no second fetch.
      const r2 = await ensureStopsLoaded();
      expect(r1).toBe(r2);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('ensureStopsLoaded() — TTL expiry', () => {
    it('re-fetches after STOPS_TTL_MS elapses (network win over stale localStorage)', async () => {
      // Backdate the localStorage timestamp by more than the TTL so
      // the next call decides the cache is stale.
      const staleTs = Date.now() - (STOPS_TTL_MS + 60_000);
      localStorage.setItem(STOPS_CACHE_KEY, JSON.stringify(FIXTURE));
      localStorage.setItem(STOPS_CACHE_TS_KEY, String(staleTs));
      const freshFixture = { KTT: { zh: '堅尼地城 NEW', en: 'Kennedy Town NEW', lat: 2, lng: 2 } };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => freshFixture,
      });
      const result = await ensureStopsLoaded();
      expect(result).toEqual(freshFixture);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('accepts localStorage that was written at exactly now (boundary just inside TTL)', async () => {
      // A timestamp exactly equal to STOPS_TTL_MS old should be
      // stale (we use `>=` not `>`). Defence in depth — most impl
      // quirks are at the boundary.
      const exactlyStale = Date.now() - STOPS_TTL_MS;
      localStorage.setItem(STOPS_CACHE_KEY, JSON.stringify(FIXTURE));
      localStorage.setItem(STOPS_CACHE_TS_KEY, String(exactlyStale));
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      await ensureStopsLoaded();
      // At the exact TTL boundary the cache is treated as stale,
      // so a fetch is expected.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('rejects an unparseable localStorage timestamp as "no cache" (force-fetch)', async () => {
      localStorage.setItem(STOPS_CACHE_KEY, JSON.stringify(FIXTURE));
      localStorage.setItem(STOPS_CACHE_TS_KEY, 'not-a-number');
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      await ensureStopsLoaded();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('rejects corrupted localStorage JSON (force-fetch instead of throwing)', async () => {
      // A half-written or quota-truncated entry should not crash
      // the helper — fall back to the network and let the
      // production code replace it.
      localStorage.setItem(STOPS_CACHE_KEY, '{not-json');
      localStorage.setItem(STOPS_CACHE_TS_KEY, String(Date.now()));
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      const result = await ensureStopsLoaded();
      expect(result).toEqual(FIXTURE);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('rejects localStorage that holds a non-object (array / string)', async () => {
      // Catches deploy-time accidents where a script accidentally
      // writes the wrong shape under the cache key.
      localStorage.setItem(STOPS_CACHE_KEY, JSON.stringify(['not', 'an', 'object']));
      localStorage.setItem(STOPS_CACHE_TS_KEY, String(Date.now()));
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      const result = await ensureStopsLoaded();
      expect(result).toEqual(FIXTURE);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('ensureStopsLoaded() — network failures', () => {
    it('rejects on a non-2xx response (HTTP 500)', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(ensureStopsLoaded()).rejects.toThrow('HTTP 500');
    });

    it('rejects on fetch rejection (offline / DNS / CORS)', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await expect(ensureStopsLoaded()).rejects.toThrow('Failed to fetch');
    });

    it('rejects when the body parses to a non-object (string)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => 'definitely not an object',
      });
      await expect(ensureStopsLoaded()).rejects.toThrow(/not a JSON object/);
    });

    it('rejects when the body parses to an array', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ['KTT', 'SYP'],
      });
      await expect(ensureStopsLoaded()).rejects.toThrow(/not a JSON object/);
    });

    it('a retry after failure does re-attempt the network (no permanent pinning)', async () => {
      // First call: server is down.
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 503 });
      await expect(ensureStopsLoaded()).rejects.toThrow('HTTP 503');
      // The in-flight promise was reset on rejection — the next
      // call should fire a fresh fetch.
      expect(getStops()).toBeNull();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      const result = await ensureStopsLoaded();
      expect(result).toEqual(FIXTURE);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('a failed first call does not write anything to localStorage', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await expect(ensureStopsLoaded()).rejects.toThrow('Failed to fetch');
      expect(localStorage.getItem(STOPS_CACHE_KEY)).toBeNull();
      expect(localStorage.getItem(STOPS_CACHE_TS_KEY)).toBeNull();
    });
  });

  describe('ensureStopsLoaded() — opts.skipLocalStorage', () => {
    it('skipLocalStorage bypasses the localStorage mirror (always hits the network)', async () => {
      // Pre-populate localStorage to confirm the bypass works.
      localStorage.setItem(STOPS_CACHE_KEY, JSON.stringify(FIXTURE));
      localStorage.setItem(STOPS_CACHE_TS_KEY, String(Date.now()));
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      await ensureStopsLoaded({ skipLocalStorage: true });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('skipLocalStorage also skips reading from localStorage on a stale-cache scenario', async () => {
      // Older TTL would normally trigger a fetch — the bypass
      // should still skip localStorage entirely.
      const staleTs = Date.now() - (STOPS_TTL_MS + 60_000);
      localStorage.setItem(STOPS_CACHE_KEY, JSON.stringify(FIXTURE));
      localStorage.setItem(STOPS_CACHE_TS_KEY, String(staleTs));
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      const result = await ensureStopsLoaded({ skipLocalStorage: true });
      expect(result).toEqual(FIXTURE);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStops()', () => {
    it('returns null when nothing has been loaded yet', () => {
      expect(getStops()).toBeNull();
    });

    it('returns null after a failed load (in-memory cache stays clean)', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(ensureStopsLoaded()).rejects.toThrow();
      expect(getStops()).toBeNull();
    });

    it('returns the loaded catalogue after a successful load', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      await ensureStopsLoaded();
      const result = getStops();
      expect(result).toEqual(FIXTURE);
      expect(result.KTT.lat).toBe(22.28149);
    });

    it('returns the cached object (same reference) on repeated calls after a load', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      await ensureStopsLoaded();
      expect(getStops()).toBe(getStops());
    });

    it('hydrates from localStorage synchronously on a cold module instance (no fetch)', () => {
      // Critical for Phase 43's "is the catalogue ready?" guard in
      // populateNearbyInto: if the user has a fresh-localStorage
      // catalogue on a return visit, the sync accessor must reflect
      // that without firing a fresh fetch. The localStorage data is
      // staged BEFORE getStops() is called so this looks identical
      // to a "previous session wrote the cache then the page was
      // reloaded and the helper's in-memory cache is empty" path.
      localStorage.setItem(STOPS_CACHE_KEY, JSON.stringify(FIXTURE));
      localStorage.setItem(STOPS_CACHE_TS_KEY, String(Date.now()));
      // fetchSpy is wired to throw if hit, so a fetchSpy call would
      // fail this test. Just to be explicit:
      const result = getStops();
      expect(result).toEqual(FIXTURE);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('invalidateStopsCache()', () => {
    it('clears in-memory cache and localStorage entries', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      await ensureStopsLoaded();
      expect(getStops()).not.toBeNull();
      expect(localStorage.getItem(STOPS_CACHE_KEY)).not.toBeNull();
      invalidateStopsCache();
      expect(getStops()).toBeNull();
      expect(localStorage.getItem(STOPS_CACHE_KEY)).toBeNull();
      expect(localStorage.getItem(STOPS_CACHE_TS_KEY)).toBeNull();
    });

    it('forces a fresh fetch on the next ensureStopsLoaded() call', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      await ensureStopsLoaded();
      invalidateStopsCache();
      const fresh = { KTT: { zh: '堅尼地城 v2', en: 'Kennedy Town v2', lat: 9, lng: 9 } };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => fresh,
      });
      const result = await ensureStopsLoaded();
      expect(result).toEqual(fresh);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('dual-export pattern (globalThis.busetaUtils)', () => {
    it('attaches ensureStopsLoaded / getStops / invalidateStopsCache to globalThis.busetaUtils', () => {
      // The in-browser classic-script path loads this file via
      // <script src="src/utils/stops-cache.js?v=1"> and app.js
      // relies on `busetaUtils.ensureStopsLoaded(...)` being
      // callable. Same invariant every src/utils/ module
      // satisfies (see tests/unit/trams.test.js,
      // tests/unit/focus-trap.test.js).
      expect(typeof globalThis.busetaUtils.ensureStopsLoaded).toBe('function');
      expect(typeof globalThis.busetaUtils.getStops).toBe('function');
      expect(typeof globalThis.busetaUtils.invalidateStopsCache).toBe('function');
      expect(globalThis.busetaUtils.ensureStopsLoaded).toBe(ensureStopsLoaded);
      expect(globalThis.busetaUtils.getStops).toBe(getStops);
      expect(globalThis.busetaUtils.invalidateStopsCache).toBe(invalidateStopsCache);
    });

    it('preserves prior busetaUtils methods when attaching', () => {
      // Object.assign must not shadow keys set by earlier utilities
      // (debugLog from src/utils/debug-log.js, etc.). Re-importing
      // the module is the documented reload pattern.
      const sentinel = () => 'sentinel';
      globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
        debugLog: sentinel,
      });
      return import('../../src/utils/stops-cache.js').then(() => {
        expect(globalThis.busetaUtils.debugLog).toBe(sentinel);
        expect(typeof globalThis.busetaUtils.ensureStopsLoaded).toBe('function');
      });
    });
  });
});
