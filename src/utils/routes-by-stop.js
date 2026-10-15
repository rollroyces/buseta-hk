// Reverse-lookup helper for "which routes serve this stop". Resolves
// TODO(v38) in app.js — the previous scan only caught terminus routes
// (where the stop matches route.origTc or route.destTc exactly). Real
// via-stops (routes that pass through without terminating) need each
// route's stop list, fetched from upstream /route-stop/{r}/{dir}/{service}.
//
// This module is pure data: callers feed it the existing route index
// plus whatever /route-stop data they've fetched (often empty on first
// visit) and get a lookup map back. The merge with the legacy terminus
// scan happens in `findRoutesServingStop` so callers can drop it in
// next to `findTerminusRoutesForStop` without a behavioural cliff when
// the new data is missing.
//
// Mirrors the pattern of Phase 7's disruption-classify module: pure ES
// module, dual-exported via `globalThis.busetaUtils` for the in-browser
// classic-script loader (see index.html).

/**
 * Strip a trailing operator code in parentheses, e.g. `觀塘站 (KWT)` →
 * `觀塘站`. Local copy of `src/utils/text.js`'s `stripKmbOpSuffix` to
 * keep this module self-contained for testing — the 3-line logic is
 * stable and matches the upstream definition byte-for-byte.
 *
 * @param {string} name
 * @returns {string}
 */
function stripOpSuffix(name) {
  if (!name) return '';
  return String(name)
    .replace(/\s*\([A-Z][A-Z0-9]{1,5}\)\s*$/, '')
    .trim();
}

/**
 * Build a reverse-lookup map from route → stop → route. The output is
 * `Map<strippedStopNameTc, Set<RouteDescriptor>>` so callers can
 * `map.get(stopNameTc)` to get every route passing through that stop.
 *
 * Pure: does no I/O, no globals. The caller is responsible for
 * collecting `routeStopsByRoute` (Map<routeKey, Array<{nameTc, ...}>>)
 * via the existing `busetaUtils.fetchJSON` against upstream `/route-stop`.
 *
 * @param {Map<string, {co: string, route: string, dir: string, service: string, origTc?: string, origEn?: string, destTc?: string, destEn?: string}>} routes - The route index (e.g. `state.index.routes ∪ state.index.ctbRoutes`).
 * @param {Map<string, Array<{stop: string, seq: number, nameTc?: string, nameEn?: string}>> | null | undefined} routeStopsByRoute - Per-route stop list (from upstream `/route-stop`). May be empty/null — the result will be empty in that case.
 * @returns {Map<string, Set<{co: string, route: string, dir: string, service: string, origTc?: string, origEn?: string, destTc?: string, destEn?: string}>>} The reverse-lookup map. Keys are stop names with operator suffix stripped (e.g. `利安`).
 */
export function buildRoutesByStopMap(routes, routeStopsByRoute) {
  const out = new Map();
  if (!routes || !routeStopsByRoute) return out;
  for (const [routeKey, stops] of routeStopsByRoute.entries()) {
    if (!Array.isArray(stops) || stops.length === 0) continue;
    const routeMeta = routes.get(routeKey);
    if (!routeMeta) continue;
    for (const stop of stops) {
      const nameTc = stripOpSuffix(stop.nameTc || '');
      if (!nameTc) continue;
      if (!out.has(nameTc)) out.set(nameTc, new Set());
      const set = out.get(nameTc);
      set.add({
        co: routeMeta.co,
        route: routeMeta.route,
        dir: routeMeta.dir,
        service: routeMeta.service,
        origTc: routeMeta.origTc || '',
        origEn: routeMeta.origEn || '',
        destTc: routeMeta.destTc || '',
        destEn: routeMeta.destEn || '',
      });
    }
  }
  return out;
}

/**
 * Look up every route serving a stop name. Merges the via-stops map
 * (built from upstream /route-stop data) with the legacy terminus-scan
 * results. Via-stops win on key collisions because they are strictly
 * more informative (a route that passes through will be in
 * `routeStopsByRoute`; a terminus-only match is a fallback).
 *
 * Drop-in replacement for `findTerminusRoutesForStop`: same return shape
 * (`Array<{co, route, dir, service, origTc, origEn, destTc, destEn}>`),
 * keyed by `co|route|dir|service` for downstream `routeMap` de-dup.
 *
 * @param {string} stopNameTc - The TC stop name (possibly with operator suffix).
 * @param {{ routesByStop?: Map<string, Set<any>>, terminusMatches?: Array<{co: string, route: string, dir: string, service: string, origTc?: string, origEn?: string, destTc?: string, destEn?: string}> }} sources - The via-stops map (from `buildRoutesByStopMap`) and the legacy terminus-scan results.
 * @returns {Array<{co: string, route: string, dir: string, service: string, origTc?: string, origEn?: string, destTc?: string, destEn?: string}>} De-duplicated route descriptors serving the stop.
 */
export function findRoutesServingStop(stopNameTc, { routesByStop, terminusMatches } = {}) {
  const want = stripOpSuffix(stopNameTc);
  if (!want) return [];
  const out = new Map();
  if (routesByStop && routesByStop.has(want)) {
    for (const info of routesByStop.get(want)) {
      const key = `${info.co}|${info.route}|${info.dir}|${info.service}`;
      if (!out.has(key)) out.set(key, info);
    }
  }
  if (Array.isArray(terminusMatches)) {
    for (const info of terminusMatches) {
      const key = `${info.co}|${info.route}|${info.dir}|${info.service}`;
      if (!out.has(key)) out.set(key, info);
    }
  }
  return Array.from(out.values());
}

// When loaded as a classic script (in index.html before app.js), attach
// the exports to globalThis.busetaUtils.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    buildRoutesByStopMap,
    findRoutesServingStop,
  });
}
