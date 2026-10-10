// Build a short, screen-reader-friendly summary string for a stop view's
// arrival list. The result is written into an aria-live="polite" region
// after every refreshBusStopView run so non-sighted users hear how many
// buses are arriving soon without each `eta-card` change re-firing.
//
// The summary only counts buses whose `minutes` field is in (0, 30] —
// "now" (minutes === 0) is excluded because the existing `arriving` label
// already covers it visually + a11y-wise. Adjust the window constant
// (`SUMMARY_WINDOW_MIN`) if the design changes.

/** Window (minutes) within which an arrival counts as "soon" for the summary. */
export const SUMMARY_WINDOW_MIN = 30;

/**
 * Count buses arriving in the next SUMMARY_WINDOW_MIN minutes, and
 * return the soonest of those minutes. Pure data — no DOM, no i18n.
 *
 * @param {Array<{arrivals: Array<{minutes: number|null}>}>} routes - The route map values.
 * @returns {{ count: number, soonestMinutes: number }} Soonest of `Infinity` when nothing's within the window.
 */
export function summariseSoon(routes) {
  let count = 0;
  let soonest = Infinity;
  for (const r of routes || []) {
    for (const a of r.arrivals || []) {
      const m = a.minutes;
      if (m == null || m <= 0 || m > SUMMARY_WINDOW_MIN) continue;
      count++;
      if (m < soonest) soonest = m;
    }
  }
  return { count, soonestMinutes: soonest };
}

/**
 * Build the user-facing summary string from a `summariseSoon` result.
 *
 *   count === 0           → '' (caller should clear the live region)
 *   soonestMinutes === 1  → `${count} ${etaCount(count)}, fastest in 1 minute`
 *   soonestMinutes > 1    → `${count} ${etaCount(count)}, fastest in ${soonest} minutes`
 *
 * Uses the existing `etaCount` translation so the phrasing matches the
 * arrival-card sub-label.
 *
 * @param {{ count: number, soonestMinutes: number }} summary - Output of `summariseSoon`.
 * @param {(key: string, ...args: any[]) => string} t_str - i18n lookup. Receives `etaCount` and `minShort`.
 * @returns {string} The summary, or '' when nothing's in the window.
 */
export function buildStopViewSummary(summary, t_str) {
  if (!summary || summary.count === 0) return '';
  const { count, soonestMinutes } = summary;
  if (soonestMinutes === 1) {
    // Single minute → don't pluralise the minute; reuse the etaCount
    // formatter so the phrasing stays in sync with the cards.
    return `${t_str('etaCount', count)}, ${soonestMinutes} ${t_str('minShort')}`;
  }
  return `${t_str('etaCount', count)}, ${soonestMinutes} ${t_str('minShort')}`;
}

// When loaded as a classic script (in index.html before app.js), attach
// the exports to globalThis.busetaUtils.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    summariseSoon,
    buildStopViewSummary,
    SUMMARY_WINDOW_MIN,
  });
}
