// Tests for src/utils/route-stops.js — the Phase 46 reverse-index rebuild.
//
// The subtle part this module exists for: `state.index.routes` is keyed
// by `makeRouteKey('KMB', …)` (the operator literal is ALWAYS 'KMB'),
// while `state.routeStopsByRoute` is keyed by the route METADATA's own
// `co` (so an LWB-operated route is 'LWB|…'). Looking routes up by the
// index key silently misses every LWB route — these cases lock that in.

import { describe, it, expect } from 'vitest';
import {
  routeMetaKey,
  buildRouteMetaLookup,
  rebuildRoutesByStopIndex,
} from '../../src/utils/route-stops.js';

/** A route-stop entry shaped like the upstream /route-stop payload. */
const stop = (nameTc, seq) => ({
  stop: 'S' + seq,
  seq,
  nameTc,
  nameEn: nameTc,
});

describe('routeMetaKey', () => {
  it('joins co|route|dir|service', () => {
    expect(routeMetaKey({ co: 'KMB', route: '1', dir: 'I', service: '1' })).toBe('KMB|1|I|1');
  });

  it('uses the metadata’s own co (not a hardcoded operator)', () => {
    expect(routeMetaKey({ co: 'LWB', route: '960', dir: 'I', service: '1' })).toBe('LWB|960|I|1');
  });

  it('tolerates missing fields', () => {
    expect(routeMetaKey({})).toBe('|||');
    expect(routeMetaKey(null)).toBe('');
  });
});

describe('buildRouteMetaLookup', () => {
  it('re-keys by the metadata’s own fields, not the map key', () => {
    // The index map stores an LWB-operated route under a 'KMB|…' key
    // (makeRouteKey hardcodes 'KMB'), but the metadata says co: 'LWB'.
    const routes = new Map([
      ['KMB|960|I|1', { co: 'LWB', route: '960', dir: 'I', service: '1', destTc: '上水' }],
    ]);
    const lookup = buildRouteMetaLookup(routes, null);
    expect(lookup.has('LWB|960|I|1')).toBe(true);
    expect(lookup.has('KMB|960|I|1')).toBe(false);
  });

  it('merges the KMB and Citybus indexes', () => {
    const routes = new Map([['KMB|1|I|1', { co: 'KMB', route: '1', dir: 'I', service: '1' }]]);
    const ctb = new Map([['CTB|930|O|1', { co: 'CTB', route: '930', dir: 'O', service: '1' }]]);
    const lookup = buildRouteMetaLookup(routes, ctb);
    expect(lookup.size).toBe(2);
    expect(lookup.has('KMB|1|I|1')).toBe(true);
    expect(lookup.has('CTB|930|O|1')).toBe(true);
  });

  it('tolerates null / empty inputs', () => {
    expect(buildRouteMetaLookup(null, null).size).toBe(0);
    expect(buildRouteMetaLookup(new Map(), new Map()).size).toBe(0);
  });
});

describe('rebuildRoutesByStopIndex', () => {
  it('rebuilds the stop → routes reverse index from the route → stops map', () => {
    const routes = new Map([
      ['KMB|1|I|1', { co: 'KMB', route: '1', dir: 'I', service: '1', destTc: '中環' }],
    ]);
    const routeStops = new Map([['KMB|1|I|1', [stop('美孚', 1), stop('中環', 2)]]]);
    const out = rebuildRoutesByStopIndex(routeStops, routes, null);
    expect(out.size).toBe(2);
    expect(out.get('美孚').size).toBe(1);
    expect(out.get('中環').size).toBe(1);
    expect(out.get('中環').values().next().value.route).toBe('1');
  });

  it('resolves LWB-operated routes (the index-key mismatch case)', () => {
    // Index key is 'KMB|960|I|1'; metadata co is 'LWB'; the route-stops
    // map is keyed 'LWB|960|I|1'. A lookup by index key would miss this
    // route entirely.
    const routes = new Map([
      ['KMB|960|I|1', { co: 'LWB', route: '960', dir: 'I', service: '1', destTc: '上水' }],
    ]);
    const routeStops = new Map([['LWB|960|I|1', [stop('上水', 1), stop('元朗', 2)]]]);
    const out = rebuildRoutesByStopIndex(routeStops, routes, null);
    expect(out.size).toBe(2);
    expect(out.get('上水').size).toBe(1);
    expect(out.get('上水').values().next().value.co).toBe('LWB');
  });

  it('strips the operator suffix from stop names', () => {
    const routes = new Map([['KMB|1|I|1', { co: 'KMB', route: '1', dir: 'I', service: '1' }]]);
    const routeStops = new Map([['KMB|1|I|1', [{ stop: 'S1', seq: 1, nameTc: '美孚 (MA973)' }]]]);
    const out = rebuildRoutesByStopIndex(routeStops, routes, null);
    expect(out.has('美孚')).toBe(true);
    expect(out.has('美孚 (MA973)')).toBe(false);
  });

  it('returns an empty map for empty input', () => {
    expect(rebuildRoutesByStopIndex(null, null, null).size).toBe(0);
    expect(rebuildRoutesByStopIndex(new Map(), new Map(), null).size).toBe(0);
  });

  it('returns an empty map when the route index is unavailable', () => {
    const routeStops = new Map([['KMB|1|I|1', [stop('美孚', 1)]]]);
    expect(rebuildRoutesByStopIndex(routeStops, null, null).size).toBe(0);
  });
});
