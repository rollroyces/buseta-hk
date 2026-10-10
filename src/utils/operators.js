// Operator classification + key helpers. Identical to app.js:1108 / app.js:1127.
// Phase 4 extraction — the inlined copies will be removed in this PR.

/**
 * Classify a KMB-family route number to its operator code based on the
 * route prefix and the origin/destination names. Defaults to 'KMB' if no
 * rule matches.
 *
 * LWB routes start with A / E / N (airport variants), R / S / T (Lantau /
 * Tung Chung), or X with airport / border keywords.
 *
 * @param {string | null | undefined} route - The route number (case-insensitive).
 * @param {string} [origTc] - Origin TC name (used for X-prefix check).
 * @param {string} [destTc] - Destination TC name (used for X-prefix check).
 * @returns {'KMB' | 'LWB'} The operator code.
 */
export function classifyKmbOp(route, origTc, destTc) {
  const r = String(route || '')
    .toUpperCase()
    .trim();
  if (/^[AEN]/.test(r)) return 'LWB';
  if (/^R\d/.test(r)) return 'LWB';
  if (/^S\d/.test(r)) return 'LWB';
  if (/^T\d/.test(r)) return 'LWB';
  if (/^X\d/.test(r) && /(機場|博覽|東涌|昂坪|港珠澳|口岸)/.test((origTc || '') + (destTc || '')))
    return 'LWB';
  return 'KMB';
}

/**
 * Map an operator code to the lowercase prefix used in API URLs.
 * Pass-through for unknown codes.
 *
 * @param {string} co - The operator code (KMB / LWB / CTB / NWFB / GMB / MTR / LRT).
 * @returns {string} The lowercase API prefix.
 */
export function opCoKey(co) {
  if (co === 'KMB') return 'kmb';
  if (co === 'LWB') return 'lwb';
  if (co === 'CTB') return 'ctb';
  if (co === 'NWFB') return 'nwfb';
  if (co === 'GMB') return 'gmb';
  if (co === 'MTR') return 'mtr';
  if (co === 'LRT') return 'lrt';
  return co;
}

if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    classifyKmbOp,
    opCoKey,
  });
}
