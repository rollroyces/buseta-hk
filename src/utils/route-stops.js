// Reverse-index rebuild for the prefetched `/route-stop` snapshot.
//
// Phase 46 — the journey-history/route-stops persistence layer used to
// serialise BOTH halves of the via-stops data:
//
//   r  →  Map<routeKey, Array<stopInfo>>      (route → its stop list)
//   s  →  Map<stopName, Set<routeInfo>>       (stop  → routes serving it)
//
// The `s` half is a pure transpose of the `r` half, so persisting both
// roughly doubled the payload for zero information gain. Combined with
// the uncapped route count, the snapshot was always larger than the
// ~5 MB per-origin localStorage quota — every write threw, nothing
// persisted, and the 3,000-request prefetch re-ran on every cold load.
//
// This module owns the rebuild so the tricky part (the route-key
// mismatch described below) is unit-testable rather than buried in the
// app.js monolith.
//
// THE KEY MISMATCH
// ----------------
// `state.index.routes` is keyed by `makeRouteKey('KMB', route, bound,
// service_type)` — the operator literal is ALWAYS 'KMB', even for a
// route that is actually operated by Long Win Bus. But the route
// *metadata* carries `co: 'LWB'`.
//
// Meanwhile `state.routeStopsByRoute` is keyed by
// `routeKey(meta)` = `${meta.co}|${meta.route}|${meta.dir}|${meta.service}`,
// which uses the metadata's own `co` — so an LWB-operated route is
// keyed `LWB|960|1|1` while the index map holds it under
// `KMB|960|1|1`.
//
// Looking routes up by the INDEX key therefore misses every LWB route.
// `buildRouteMetaLookup` re-keys by the metadata's own fields so the
// two line up for every operator.
//
// Mirrors the dual-export pattern of every other `src/utils/` module:
// real ESM exports for Vitest, plus a `globalThis.busetaUtils` attach
// for the in-browser classic-script loader.

import { buildRoutesByStopMap } from './routes-by-stop.js';

/**
 * The canonical route key. Matches `makeRouteKey` / `routeKey` in app.js:
 * `${co}|${route}|${dir}|${service}`.
 *
 * @param {{co?: string, route?: string, dir?: string, service?: string}} meta
 * @returns {string}
 */
export function routeMetaKey(meta) {
  if (!meta) return '';
  return `${meta.co || ''}|${meta.route || ''}|${meta.dir || ''}|${meta.service || ''}`;
}

/**
 * Build a lookup of route metadata keyed by the metadata's OWN
 * `co|route|dir|service`, from the route index maps.
 *
 * @param {Map<string, object>|null|undefined} routes - e.g. `state.index.routes`
 * @param {Map<string, object>|null|undefined} ctbRoutes - e.g. `state.index.ctbRoutes`
 * @returns {Map<string, object>}
 */
export function buildRouteMetaLookup(routes, ctbRoutes) {
  const out = new Map();
  const addAll = (map) => {
    if (!map || typeof map.values !== 'function') return;
    for (const meta of map.values()) {
      if (!meta) continue;
      out.set(routeMetaKey(meta), meta);
    }
  };
  addAll(routes);
  addAll(ctbRoutes);
  return out;
}

/**
 * Rebuild the stop → routes reverse index from the route → stops map.
 *
 * @param {Map<string, Array<object>>|null|undefined} routeStopsByRoute
 * @param {Map<string, object>|null|undefined} routes
 * @param {Map<string, object>|null|undefined} ctbRoutes
 * @returns {Map<string, Set<object>>} stop name (operator suffix stripped) → set of route descriptors
 */
export function rebuildRoutesByStopIndex(routeStopsByRoute, routes, ctbRoutes) {
  if (!routeStopsByRoute || routeStopsByRoute.size === 0) return new Map();
  const metaByKey = buildRouteMetaLookup(routes, ctbRoutes);
  if (metaByKey.size === 0) return new Map();
  return buildRoutesByStopMap(metaByKey, routeStopsByRoute);
}

// Dual-export — attach to globalThis.busetaUtils for the classic-script
// loader in index.html.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    routeMetaKey,
    buildRouteMetaLookup,
    rebuildRoutesByStopIndex,
  });
}
