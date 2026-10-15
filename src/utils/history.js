// Journey-history helper. Records `{ kind, id, name, ts }` entries every
// time the user opens a route / stop / station detail, and exposes
// grouped-by-day queries + removal helpers for the dedicated History
// view. Pure data — no DOM, no i18n. Storage is `localStorage` under
// `buseta.history`; entries never carry user-identifying information
// (no IP, no UA fingerprint, no geolocation) so the surface is purely
// a local "recently viewed" rail.
//
// Phase 44 — PWA share-target integration + journey-history timeline.
//
// Mirrors the dual-export pattern used by every src/utils/ module: real
// ESM exports for Vitest, plus a globalThis.busetaUtils attach so the
// classic-script <script> tag in index.html can call the helpers
// without an import.

/** localStorage key for the journey history. */
export const HISTORY_KEY = 'buseta.history';

/** Maximum number of entries kept in storage. */
export const HISTORY_CAP = 100;

/** Kinds of visits the app records. Free-form strings so future views can join. */
export const HISTORY_KINDS = Object.freeze({
  ROUTE: 'route',
  STOP: 'stop',
});

/**
 * Read the raw history array from localStorage. Returns `[]` on any
 * storage failure or shape mismatch — never throws, never returns
 * something the caller can't iterate over. Pure.
 *
 * @returns {Array<{kind: string, id: string, name?: string, ts?: number}>}
 */
export function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Write the history array to localStorage. Silent on failure — the
 * helper never throws so callers don't have to wrap every call in
 * try/catch.
 *
 * @param {Array<{kind: string, id: string, name?: string, ts?: number}>} arr
 */
export function writeHistory(arr) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
  } catch (_) {
    /* quota exceeded / private mode / etc. */
  }
}

/**
 * Compose the dedup key used by record / remove. Treats `kind` as a
 * string and `id` as a string. Returned shape is `{kind, id}` so the
 * `String(...)` normalisation is shared between the writer and the
 * reader and the JSON shape stays stable.
 *
 * @param {{kind: string, id: string}} entry
 * @returns {{kind: string, id: string}}
 */
export function historyKey(entry) {
  return {
    kind: String(entry && entry.kind != null ? entry.kind : ''),
    id: String(entry && entry.id != null ? entry.id : ''),
  };
}

/**
 * Record a visit. Removes any prior entry with the same `kind:id`
 * (re-recording the same route / stop moves it to the top, the same
 * way `pushRecent` works in app.js) and inserts the new entry at the
 * front. Caps the resulting array at HISTORY_CAP entries by dropping
 * the oldest tail. Returns the resulting array so callers can render
 * immediately without a separate `getHistory()` round-trip.
 *
 * Required fields: `kind`, `id`. Optional: `name`, `ts` (a finite
 * number — the caller is responsible for stamping `Date.now()` if
 * they want a sensible timestamp; omitted `ts` sorts to the bottom
 * via the `(ts || 0)` comparator), `co` (operator code, e.g. `'KMB'`).
 * The helper does NOT auto-fill `Date.now()` for missing `ts` — the
 * app's call sites always stamp `ts: Date.now()` explicitly so the
 * day-grouping logic has a reliable anchor, and silently substituting
 * a timestamp here would mask caller bugs.
 *
 * @param {{kind: string, id: string, name?: string, ts?: number, co?: string}} entry
 * @returns {Array<{kind: string, id: string, name?: string, ts?: number, co?: string}>}
 */
export function recordVisit(entry) {
  if (!entry || entry.kind == null || entry.id == null) return readHistory();
  const key = historyKey(entry);
  const list = readHistory().filter((e) => {
    const k = historyKey(e);
    return !(k.kind === key.kind && k.id === key.id);
  });
  const ts = typeof entry.ts === 'number' && Number.isFinite(entry.ts) ? entry.ts : undefined;
  list.unshift({
    kind: key.kind,
    id: key.id,
    name: typeof entry.name === 'string' ? entry.name : '',
    co: typeof entry.co === 'string' ? entry.co : '',
    ts,
  });
  if (list.length > HISTORY_CAP) list.length = HISTORY_CAP;
  writeHistory(list);
  return list;
}

/**
 * Return every history entry sorted by `ts` DESC (newest first).
 * Pure: reads storage on every call, no caching.
 *
 * @returns {Array<{kind: string, id: string, name?: string, ts?: number, co?: string}>}
 */
export function getHistory() {
  return readHistory()
    .slice()
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

/**
 * Return history entries split into three buckets: `today`,
 * `yesterday`, and `earlier`. Day boundaries are computed in the
 * user's local timezone (so "today" matches what their wall clock
 * reads). Pass an explicit `now` (ms) for testing — without it the
 * helper uses `Date.now()`.
 *
 * Each bucket is sorted by `ts` DESC independently, so the final
 * `{ today, yesterday, earlier }` shape is render-ready.
 *
 * @param {number} [now] - Override the current time (ms since epoch). Defaults to `Date.now()`. Used by tests; the runtime caller always omits it.
 * @returns {{ today: Array<object>, yesterday: Array<object>, earlier: Array<object> }}
 */
export function getHistoryGroupedByDay(now) {
  const ref = typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
  const today = new Date(ref);
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const yesterdayMs = todayMs - 24 * 60 * 60 * 1000;

  const todayBucket = [];
  const yesterdayBucket = [];
  const earlierBucket = [];
  for (const e of readHistory()) {
    const ts = typeof e.ts === 'number' ? e.ts : 0;
    if (ts >= todayMs) todayBucket.push(e);
    else if (ts >= yesterdayMs) yesterdayBucket.push(e);
    else earlierBucket.push(e);
  }
  const byTsDesc = (a, b) => (b.ts || 0) - (a.ts || 0);
  todayBucket.sort(byTsDesc);
  yesterdayBucket.sort(byTsDesc);
  earlierBucket.sort(byTsDesc);
  return { today: todayBucket, yesterday: yesterdayBucket, earlier: earlierBucket };
}

/**
 * Remove a single entry by `kind` + `id`. Returns the resulting array.
 *
 * @param {string} kind
 * @param {string} id
 * @returns {Array<{kind: string, id: string, name?: string, ts?: number, co?: string}>}
 */
export function removeHistoryEntry(kind, id) {
  const list = readHistory().filter((e) => !(e.kind === kind && e.id === id));
  writeHistory(list);
  return list;
}

/**
 * Drop every history entry. Returns `[]`. Safe to call from any
 * context — the storage write is wrapped in try/catch.
 *
 * @returns {Array<never>}
 */
export function clearHistory() {
  writeHistory([]);
  return [];
}

// When loaded as a classic script (in index.html before app.js), attach
// the exports to globalThis.busetaUtils so app.js can call
// `busetaUtils.recordVisit(...)` without an import.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    HISTORY_KEY,
    HISTORY_CAP,
    HISTORY_KINDS,
    readHistory,
    writeHistory,
    recordVisit,
    getHistory,
    getHistoryGroupedByDay,
    removeHistoryEntry,
    clearHistory,
    historyKey,
  });
}
