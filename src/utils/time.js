// Time helpers. Identical implementation to those inlined in planner.js
// (line ~263). Phase 3 will replace the inlined copies with imports
// from this module.

/** Walking speed in metres per minute. The flat 60 m/min is the v47
 *  baseline; replaced by fetchRealWalkRoute() when GraphHopper is reachable. */
export const WALK_M_PER_MIN = 60;

/** Bus speed in km/h (assumed for the trip planner). */
export const BUS_KMH = 20;

/** Bus speed in metres per minute, derived from BUS_KMH. */
export const BUS_KMH_M_PER_MIN = (BUS_KMH * 1000) / 60;

/**
 * Convert a walking distance (in metres) to minutes at the default
 * walking speed (WALK_M_PER_MIN).
 *
 * @param {number} meters - Walking distance in metres.
 * @returns {number} Walking time in minutes.
 */
export function walkMinutes(meters) {
  return meters / WALK_M_PER_MIN;
}

/**
 * Convert a bus ride distance (in metres) to minutes at BUS_KMH_M_PER_MIN.
 *
 * @param {number} meters - Bus ride distance in metres.
 * @returns {number} Ride time in minutes.
 */
export function rideMinutes(meters) {
  return meters / BUS_KMH_M_PER_MIN;
}