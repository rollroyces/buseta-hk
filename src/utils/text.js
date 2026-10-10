// Text / locale helpers. Identical implementations to those inlined in
// app.js. Phase 5 extraction — inlined copies will be removed in this PR.

/**
 * Strip a trailing operator code in parentheses from a stop / route name,
 * e.g. `觀塘站 (KWT)` → `觀塘站`. The operator code must be 2-6 chars,
 * start with an uppercase ASCII letter, and may include uppercase ASCII
 * alphanumerics.
 *
 * @param {string} name - The stop / route name, possibly with a trailing
 *   `(OPCODE)` suffix.
 * @returns {string} The name with the suffix stripped; empty string if the
 *   input was empty.
 */
export function stripKmbOpSuffix(name) {
  if (!name) return '';
  return String(name)
    .replace(/\s*\([A-Z][A-Z0-9]{1,5}\)\s*$/, '')
    .trim();
}

/**
 * Pick a stop / route name in the requested UI language. Falls back to the
 * other Chinese variant (tc ↔ sc) if the requested variant is empty, then
 * to English. Operator APIs return `name_tc` / `name_sc` / `name_en`
 * (sometimes camelCase `nameTc` / `nameSc` / `nameEn`).
 *
 * @param {{ name_tc?: string, nameTc?: string, name_sc?: string, nameSc?: string, name_en?: string, nameEn?: string } | null | undefined} obj - Stop or route with name fields.
 * @param {string} lang - The UI language ('zh-Hant' | 'zh-Hans' | 'en').
 * @returns {string} The picked name; empty string if obj is null/undefined.
 */
export function pickName(obj, lang) {
  if (!obj) return '';
  const wantTc = lang !== 'zh-Hans';
  const tc = obj.name_tc || obj.nameTc || '';
  const sc = obj.name_sc || obj.nameSc || '';
  const en = obj.name_en || obj.nameEn || '';
  if (lang === 'en') return en || tc || sc;
  if (wantTc) return tc || sc || en;
  return sc || tc || en;
}

/**
 * Parse a single CSV line into an array of field strings, supporting
 * quoted fields with embedded commas and escaped double-quotes (`""`).
 *
 * @param {string} line - The CSV line (no trailing newline).
 * @returns {string[]} The parsed fields.
 */
export function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuote = false;
      } else cur += ch;
    } else if (ch === '"') inQuote = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    stripKmbOpSuffix,
    pickName,
    parseCsvLine,
  });
}
