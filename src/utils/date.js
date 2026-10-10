// Pure date / time helpers. Identical implementations to those inlined in
// app.js (lines ~3929-3949, 4115-4128, 4200-4206). Phase 7 extraction —
// the inlined copies in app.js will be replaced by busetaUtils.* lookups
// in the same PR.

/**
 * Parse a Transport Department `DD.MM.YYYY` date string into the canonical
 * `YYYY-MM-DD` form used everywhere else (comparable via plain string
 * compare). Returns '' on any malformed input so the caller can drop the
 * notice rather than surface a half-parsed row.
 *
 * @param {unknown} s - The TD-style date string. Non-strings return ''.
 * @returns {string} The canonical YYYY-MM-DD, or '' if unparseable.
 */
export function parseTdDate(s) {
  if (typeof s !== 'string') return '';
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s.trim());
  if (!m) return '';
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Today's date in the Asia/Hong_Kong time zone as `YYYY-MM-DD` — the same
 * shape the disruption `until` filter compares against. Falls back to UTC
 * for the vanishingly rare browser that lacks full Intl+timeZone support.
 *
 * @returns {string} Today's date in YYYY-MM-DD form.
 */
export function hktToday() {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Add `n` days to a `YYYY-MM-DD` string and return the same shape. Used to
 * synthesise a 30-day `until` for notices that only carry a
 * StartEffectiveDate. Returns the input string on parse failure so the
 * caller never produces `undefined`.
 *
 * @param {string} ymd - A `YYYY-MM-DD` string.
 * @param {number} n - The number of days to add (may be negative).
 * @returns {string} The new YYYY-MM-DD string, or ymd on parse failure.
 */
export function addDays(ymd, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
  if (!m) return ymd || '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// When loaded as a classic script (in index.html before app.js), attach
// the exports to globalThis.busetaUtils.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    parseTdDate,
    hktToday,
    addDays,
  });
}
