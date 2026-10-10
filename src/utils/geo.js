// Geo helpers. Identical implementations to those inlined in app.js (line
// ~4706) and planner.js (line ~252). Phase 3 (modularization) will replace
// the inlined copies with imports from this module; until then, this
// module is the canonical implementation for the test suite and the
// reference the inlined copies should match.

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two lat/lng points, in kilometres.
 * Uses the standard haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1, in decimal degrees.
 * @param {number} lng1 - Longitude of point 1, in decimal degrees.
 * @param {number} lat2 - Latitude of point 2, in decimal degrees.
 * @param {number} lng2 - Longitude of point 2, in decimal degrees.
 * @returns {number} Distance in kilometres.
 */
export function haversine(lat1, lng1, lat2, lng2) {
  const R = EARTH_RADIUS_KM;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Format a distance value (in km) for display: "<n> m" if under 1 km,
 * "<n.n> km" otherwise.
 *
 * @param {number} km - Distance in kilometres.
 * @returns {string} Human-readable distance string.
 */
export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// When loaded as a classic script (in index.html before app.js), attach
// the exports to globalThis.busetaUtils so app.js / planner.js can call
// them as `busetaUtils.haversine(...)`. Idempotent — re-merges into an
// existing namespace if multiple utils files load.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    haversine,
    formatDistance,
  });
}
