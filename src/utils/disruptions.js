// Disruption expiry helper. Identical implementation to the function
// inlined in app.js (line ~4410). Phase 3 will replace the inlined
// copy with an import from here.

/**
 * Return true if the given disruption item has expired (its `until`
 * date is strictly before today in Asia/Hong_Kong). Items without an
 * `until` field are treated as indefinite and never expire via this
 * check. Unparseable values fall through to false.
 *
 * @param {{ until?: string } | null | undefined} it - Disruption item.
 * @returns {boolean} True if expired, false otherwise.
 */
export function isDisruptionExpired(it) {
  if (!it || !it.until) return false;
  // toLocaleDateString with 'en-CA' produces YYYY-MM-DD, the same
  // shape our JSON uses, so a plain string compare is chronological.
  let todayHkt;
  try {
    todayHkt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
  } catch (_) {
    // Older browsers without full Intl support — fall back to UTC.
    todayHkt = new Date().toISOString().slice(0, 10);
  }
  return typeof it.until === 'string' && it.until < todayHkt;
}

// When loaded as a classic script, attach to globalThis.busetaUtils.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    isDisruptionExpired,
  });
}
