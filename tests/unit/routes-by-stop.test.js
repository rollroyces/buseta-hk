import { describe, it, expect } from 'vitest';
import { buildRoutesByStopMap, findRoutesServingStop } from '../../src/utils/routes-by-stop.js';

// Minimal shape fixtures — only the fields the helper actually reads.
// Keeping these tiny makes the tests resilient to upstream API shape
// drift in fields the helper doesn't touch (e.g. `nameSc`, `data_timestamp`).
const baseRoute = (overrides = {}) => ({
  co: 'KMB',
  route: '286C',
  dir: 'I',
  service: '1',
  origTc: '利安',
  origEn: 'Lee On',
  destTc: '維港城',
  destEn: 'Maritime Square',
  ...overrides,
});

const baseStop = (overrides = {}) => ({
  stop: 'MA001',
  seq: 1,
  nameTc: '利安',
  nameEn: 'Lee On',
  ...overrides,
});

describe('buildRoutesByStopMap', () => {
  it('returns an empty map when routeStopsByRoute is null', () => {
    const map = buildRoutesByStopMap(new Map(), null);
    expect(map.size).toBe(0);
  });

  it('returns an empty map when routeStopsByRoute is undefined', () => {
    const map = buildRoutesByStopMap(new Map(), undefined);
    expect(map.size).toBe(0);
  });

  it('indexes a route → stop mapping by stripped TC name', () => {
    const routes = new Map([['KMB|286C|I|1', baseRoute()]]);
    const routeStops = new Map([
      ['KMB|286C|I|1', [baseStop({ nameTc: '利安 (KMB)' }), baseStop({ nameTc: '美孚', seq: 2 })]],
    ]);
    const map = buildRoutesByStopMap(routes, routeStops);
    expect(map.size).toBe(2);
    expect(map.has('利安')).toBe(true);
    expect(map.has('美孚')).toBe(true);
  });

  it('strips the operator-suffix `(KMB)` from the TC name', () => {
    const routes = new Map([['KMB|286C|I|1', baseRoute()]]);
    const routeStops = new Map([['KMB|286C|I|1', [baseStop({ nameTc: '利安 (KMB)' })]]]);
    const map = buildRoutesByStopMap(routes, routeStops);
    expect(map.has('利安')).toBe(true);
    expect(map.has('利安 (KMB)')).toBe(false);
  });

  it('groups multiple routes serving the same stop into a single Set', () => {
    const routes = new Map([
      ['KMB|286C|I|1', baseRoute({ route: '286C' })],
      ['KMB|87K|I|1', baseRoute({ route: '87K', origTc: '利安', destTc: '美孚' })],
      ['CTB|680|I|1', baseRoute({ co: 'CTB', route: '680', origTc: '利安', destTc: '中環' })],
    ]);
    const routeStops = new Map([
      ['KMB|286C|I|1', [baseStop({ nameTc: '利安' })]],
      ['KMB|87K|I|1', [baseStop({ nameTc: '利安' })]],
      ['CTB|680|I|1', [baseStop({ nameTc: '利安' })]],
    ]);
    const map = buildRoutesByStopMap(routes, routeStops);
    const leeOn = map.get('利安');
    expect(leeOn).toBeDefined();
    expect(leeOn.size).toBe(3);
    const routes_ = Array.from(leeOn).map((r) => `${r.co}|${r.route}`);
    expect(routes_).toContain('KMB|286C');
    expect(routes_).toContain('KMB|87K');
    expect(routes_).toContain('CTB|680');
  });

  it('skips entries where the route meta is missing from the index', () => {
    const routes = new Map(); // empty
    const routeStops = new Map([['KMB|286C|I|1', [baseStop({ nameTc: '利安' })]]]);
    const map = buildRoutesByStopMap(routes, routeStops);
    expect(map.size).toBe(0);
  });

  it('skips stops with empty (after strip) TC names', () => {
    const routes = new Map([['KMB|286C|I|1', baseRoute()]]);
    const routeStops = new Map([
      ['KMB|286C|I|1', [baseStop({ nameTc: '(ABC)' }), baseStop({ nameTc: '', seq: 2 })]],
    ]);
    const map = buildRoutesByStopMap(routes, routeStops);
    expect(map.size).toBe(0);
  });

  it('propagates origTc / origEn / destTc / destEn from route meta, not stops', () => {
    const routes = new Map([
      [
        'KMB|286C|I|1',
        baseRoute({
          origTc: '利安',
          origEn: 'Lee On',
          destTc: '維港城',
          destEn: 'Maritime Square',
        }),
      ],
    ]);
    const routeStops = new Map([['KMB|286C|I|1', [baseStop({ nameTc: '美孚' })]]]);
    const map = buildRoutesByStopMap(routes, routeStops);
    const meifu = map.get('美孚');
    expect(meifu).toBeDefined();
    const info = Array.from(meifu)[0];
    expect(info.origTc).toBe('利安');
    expect(info.origEn).toBe('Lee On');
    expect(info.destTc).toBe('維港城');
    expect(info.destEn).toBe('Maritime Square');
  });
});

describe('findRoutesServingStop', () => {
  it('returns [] for an empty stop name', () => {
    expect(findRoutesServingStop('', { routesByStop: new Map(), terminusMatches: [] })).toEqual([]);
    expect(findRoutesServingStop(null, { routesByStop: new Map(), terminusMatches: [] })).toEqual(
      []
    );
  });

  it('returns [] when neither map nor matches are supplied', () => {
    expect(findRoutesServingStop('利安')).toEqual([]);
    expect(findRoutesServingStop('利安', {})).toEqual([]);
  });

  it('returns via-stops matches when the routesByStop map has them', () => {
    const routesByStop = new Map();
    routesByStop.set('利安', new Set([baseRoute({ route: '286C' })]));
    const out = findRoutesServingStop('利安 (KMB)', { routesByStop });
    expect(out.length).toBe(1);
    expect(out[0].route).toBe('286C');
  });

  it('merges terminus matches with via-stops (via-stops win on collision)', () => {
    const routesByStop = new Map();
    routesByStop.set(
      '利安',
      new Set([
        // Different origTc in the via-stops version (terminus scan may
        // have stale data) — both should still surface.
        baseRoute({ route: '286C', origTc: '利安', origEn: 'Lee On' }),
      ])
    );
    const terminusMatches = [baseRoute({ route: '87K', origTc: '利安', origEn: 'Lee On' })];
    const merged = findRoutesServingStop('利安', { routesByStop, terminusMatches });
    expect(merged.length).toBe(2);
    const routes = merged.map((r) => r.route).sort();
    expect(routes).toEqual(['286C', '87K']);
  });

  it('dedupes by co|route|dir|service key (via-stops takes precedence on collision)', () => {
    const routesByStop = new Map();
    routesByStop.set('利安', new Set([baseRoute({ route: '286C', origTc: 'ViaStopOrig' })]));
    // Same route in both sources — only the via-stops one should win.
    const terminusMatches = [baseRoute({ route: '286C', origTc: 'TerminusOrig' })];
    const merged = findRoutesServingStop('利安', { routesByStop, terminusMatches });
    expect(merged.length).toBe(1);
    expect(merged[0].origTc).toBe('ViaStopOrig');
  });

  it('falls back to terminus-only matches when routesByStop is empty/missing', () => {
    const terminusMatches = [baseRoute({ route: '286C' }), baseRoute({ route: '87K' })];
    expect(findRoutesServingStop('利安', { terminusMatches }).length).toBe(2);
    expect(findRoutesServingStop('利安', { routesByStop: new Map(), terminusMatches }).length).toBe(
      2
    );
  });

  it('strips the operator-suffix from the input stop name before lookup', () => {
    const routesByStop = new Map();
    routesByStop.set('利安', new Set([baseRoute()]));
    const out = findRoutesServingStop('利安 (KMB)', { routesByStop });
    expect(out.length).toBe(1);
  });

  it('returns [] when the map does not contain the stop name', () => {
    const routesByStop = new Map();
    routesByStop.set('其他站', new Set([baseRoute()]));
    expect(findRoutesServingStop('利安', { routesByStop })).toEqual([]);
  });
});
