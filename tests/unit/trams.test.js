// @vitest-environment jsdom
//
// Tests for src/utils/trams.js — the Hong Kong Tramways stop-catalogue
// helper extracted in Phase 38.
//
// The bundled assets/tram-stops.json is the canonical source today; the
// fetch helper just JSON-parses it. We mock `globalThis.fetch` so the
// test doesn't depend on the actual file being loadable from Vitest's
// CWD — the same isolation strategy tests/unit/network.test.js uses
// for fetchJSON's coverage.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchTramStops } from '../../src/utils/trams.js';

// A minimal but realistic stand-in for assets/tram-stops.json. The
// Phase 38 bundled file has 24 stops; this fixture keeps three to
// keep the assertions readable. The shape matches mtr-stops.json:
// each entry is `{ zh, en, lat, lng }`, codes are 3-letter uppercase.
const FIXTURE = {
  _meta: { source: 'test fixture', scrapedOn: '2026-10-11' },
  KTT: { zh: '堅尼地城總站', en: 'Kennedy Town Terminus', lat: 22.28149, lng: 114.12864 },
  SYP: { zh: '西營盤', en: 'Sai Ying Pun', lat: 22.28662, lng: 114.14283 },
  SHW: { zh: '上環', en: 'Sheung Wan', lat: 22.28651, lng: 114.15283 },
};

describe('src/utils/trams.js', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  describe('fetchTramStops() — happy path', () => {
    it('returns the parsed JSON when the bundled file loads', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      const result = await fetchTramStops();
      expect(result).toEqual(FIXTURE);
      expect(result.KTT.en).toBe('Kennedy Town Terminus');
    });

    it('hits assets/tram-stops.json with cache: force-cache', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      await fetchTramStops();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('assets/tram-stops.json');
      // Same-origin static asset; force-cache so the SW's ASSET_CACHE
      // bucket wins over the network. credentials: 'omit' matches the
      // other catalog fetchers (mtr-stops, lrt-stops).
      expect(init.cache).toBe('force-cache');
      expect(init.credentials).toBe('omit');
    });

    it('passes the `_meta` header through untouched', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => FIXTURE,
      });
      const result = await fetchTramStops();
      expect(result._meta).toEqual(FIXTURE._meta);
    });
  });

  describe('fetchTramStops() — failure paths return null', () => {
    it('returns null on a non-2xx response (e.g. 404 during deploy)', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 404 });
      expect(await fetchTramStops()).toBeNull();
    });

    it('returns null when fetch itself rejects (offline / DNS / CORS)', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      expect(await fetchTramStops()).toBeNull();
    });

    it('returns null when the body parses to a non-object (string)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => 'not json',
      });
      expect(await fetchTramStops()).toBeNull();
    });

    it('returns null when the body parses to an array (wrong shape)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ['KTT', 'SYP'],
      });
      expect(await fetchTramStops()).toBeNull();
    });

    it('returns null when the body has no recognisable stop entries', async () => {
      // Defends against a future upstream returning an error envelope
      // (e.g. `{ error: "rate limited" }`). The shape check looks for
      // at least one entry with the { zh, en, lat, lng } shape; an
      // envelope fails the check and surfaces as null.
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'rate limited', code: 429 }),
      });
      expect(await fetchTramStops()).toBeNull();
    });

    it('returns null when an entry is missing the { zh, en, lat, lng } shape', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          KTT: { name: 'Kennedy Town' }, // wrong shape
        }),
      });
      expect(await fetchTramStops()).toBeNull();
    });
  });

  describe('dual-export pattern', () => {
    it('attaches fetchTramStops to globalThis.busetaUtils', () => {
      // Same invariant every src/utils/ module satisfies — the
      // in-browser classic-script path loads this file via
      // <script src="src/utils/trams.js?v=1"> and app.js relies on
      // `busetaUtils.fetchTramStops(...)` being callable.
      expect(typeof globalThis.busetaUtils.fetchTramStops).toBe('function');
      expect(globalThis.busetaUtils.fetchTramStops).toBe(fetchTramStops);
    });

    it('preserves prior busetaUtils methods when attaching', async () => {
      // Object.assign with the same object must not overwrite keys it
      // didn't ship — guard against accidentally shadowing
      // busetaUtils.debugLog (set by src/utils/debug-log.js) when
      // both modules load.
      const sentinel = () => 'sentinel';
      globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
        debugLog: sentinel,
      });
      // Re-import to trigger the side-effect.
      await import('../../src/utils/trams.js');
      expect(globalThis.busetaUtils.debugLog).toBe(sentinel);
      expect(typeof globalThis.busetaUtils.fetchTramStops).toBe('function');
    });
  });
});
