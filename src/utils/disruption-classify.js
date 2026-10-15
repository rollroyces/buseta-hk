// TD disruption-pipeline classifiers. Identical implementations to those
// inlined in app.js (lines ~3957-4069). Phase 7 extraction — the inlined
// copies will be removed in the same PR.
//
// These helpers are confined to the disruption-feed code; they share little
// with the route-level classifyKmbOp in src/utils/operators.js, which works on
// route numbers rather than free-form TC/EN titles.

// Severe (full-stop) disruption keywords — matched first so they win over
// warn and info. Bilingual list: TC + EN.
const SEVERITY_SEVERE = [
  /暫停/,
  /停駛/,
  /取消服務/,
  /全線停駛/,
  /封閉/,
  /封路/,
  /suspend/i,
  /suspended/i,
  /cancellation/i,
  /cancelled/i,
  /closed/i,
  /closure/i,
];

// Warn (reroute / relocation / service adjustment) keywords.
const SEVERITY_WARN = [
  /改道/,
  /繞道/,
  /繞經/,
  /臨時遷移/,
  /調整服務/,
  /服務調整/,
  /縮短/,
  /detour/i,
  /relocation/i,
  /relocated/i,
  /diversion/i,
  /service adjustment/i,
  /temporary relocation/i,
];

// Info (fare / enhancement / new stop) keywords — anything that doesn't
// affect the rider's next journey.
const SEVERITY_INFO = [
  /車費/,
  /加強/,
  /更換營辦商/,
  /新增/,
  /fare/i,
  /enhancement/i,
  /operator replacement/i,
  /new stop/i,
];

/**
 * Map an operator prefix found in the TC/EN title to the canonical
 * operator code used by disruptionsForUserRoutes (KMB / LWB / CTB / NWFB /
 * GMB / MTR / LRT). Returns null for cross-harbour-only and area-wide
 * notices — those should match any operator carrying the route number (or,
 * in the area-wide case, be dropped at the route-extraction stage).
 *
 * Order matters: more-specific operators (LWB → CTB → NWFB) must match
 * before GMB so a title like "Long Win" doesn't fall through to the
 * catch-all minibus rule.
 *
 * @param {string} titleTc - The TC title.
 * @param {string} titleEn - The EN title.
 * @returns {'KMB' | 'LWB' | 'CTB' | 'NWFB' | 'GMB' | 'MTR' | 'LRT' | null} The operator code, or null if none matched.
 */
export function classifyOperator(titleTc, titleEn) {
  const body = `${titleTc || ''} ${titleEn || ''}`;
  if (/九巴|KMB/.test(body)) return 'KMB';
  if (/龍運|Long Win|LWB/.test(body)) return 'LWB';
  if (/城巴|CTB|Citybus/.test(body)) return 'CTB';
  if (/新巴|NWFB/.test(body)) return 'NWFB';
  if (/港島專線小巴|新界專線小巴|九龍專線小巴|專線小巴|GMB|Green Minibus/.test(body)) return 'GMB';
  if (/港鐵巴士|港鐵接駁巴士|MTR Feeder Bus|MTR/.test(body)) return 'MTR';
  if (/輕鐵|Light Rail|LRT/.test(body)) return 'LRT';
  return null;
}

/**
 * Pull a route-number list out of the TC and EN title text. Returns the
 * merged, de-duplicated result so the caller can attach one item per route
 * per notice. Returns [] when no parseable route number exists — area-wide
 * notices like "Bus Stop Relocation on Wah Fu Road" deliberately fail both
 * extractors so they're dropped here rather than surfacing as banner items
 * with an empty `route`.
 *
 * @param {string} titleTc - The TC title.
 * @param {string} titleEn - The EN title.
 * @returns {string[]} The merged, de-duplicated route numbers (uppercase ASCII alphanumerics).
 */
export function extractRouteNumbers(titleTc, titleEn) {
  const tc = titleTc || '';
  const en = titleEn || '';
  const out = new Set();
  const routeLike = /^[A-Z0-9][0-9A-Z]*$/;

  // CN pattern: text between 第 and 號 (or 號線). Capture as wide a span
  // as the title offers, then split on the CN/EN separator characters
  // that the TD titles use between route numbers in a list. Token filter
  // requires at least one alphanumeric with a leading letter-or-digit —
  // pure punctuation / parens fall through.
  const cnRegex = /第([^第]{0,40}?)號(?:線)?/g;
  let cm;
  while ((cm = cnRegex.exec(tc)) !== null) {
    for (const part of cm[1].split(/[、，,及和 \t()（）]/)) {
      const t = part.trim();
      if (routeLike.test(t)) out.add(t);
    }
  }

  // EN pattern: "Route No." / "Route Nos." followed by a comma- and
  // "and"-separated list of route tokens. Capture up to the next sentence
  // boundary (".", "Route ", or end-of-string) so a trailing prose
  // fragment like "Siu Sai Wan (Island Resort)" doesn't sneak in. Splits
  // into chunks, then takes the leading route-like token from each chunk.
  const enRegex = /Route\s+Nos?\.?\s*(.+?)(?:\.|\s+Route\s+|$)/g;
  let em;
  while ((em = enRegex.exec(en)) !== null) {
    for (const part of em[1].split(/,\s*|\s+and\s+/)) {
      const m2 = /^\s*([A-Z0-9][0-9A-Z]*)/.exec(part);
      if (m2) out.add(m2[1]);
    }
  }

  return Array.from(out);
}

/**
 * Heuristic severity classifier — scans the TC + EN title text (and the TC
 * + EN content bodies — the bodies often restate the impact in plainer
 * language than the title). Severe keywords win over warn, warn over info,
 * info over the default. The SC body is deliberately skipped to keep the
 * haystack small (it's usually a near-duplicate of the TC one).
 *
 * @param {string} titleTc - The TC title.
 * @param {string} titleEn - The EN title.
 * @param {string} contentTc - The TC content (already HTML-stripped).
 * @param {string} contentEn - The EN content (already HTML-stripped).
 * @returns {'severe' | 'warn' | 'info'} The classified severity (defaults to 'info').
 */
export function classifySeverity(titleTc, titleEn, contentTc, contentEn) {
  const body = `${titleTc || ''} ${titleEn || ''} ${contentTc || ''} ${contentEn || ''}`;
  for (const re of SEVERITY_SEVERE) if (re.test(body)) return 'severe';
  for (const re of SEVERITY_WARN) if (re.test(body)) return 'warn';
  for (const re of SEVERITY_INFO) if (re.test(body)) return 'info';
  return 'info';
}

// When loaded as a classic script (in index.html before app.js), attach
// the exports to globalThis.busetaUtils.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    classifyOperator,
    extractRouteNumbers,
    classifySeverity,
  });
}
