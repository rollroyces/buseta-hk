// Lazy-loaded stop-coordinate catalogue (Phase 43).
//
// hk-stops.json is ~190 KB unpacked (~50 KB gzip). On the very first
// visit the file is fetched by every consumer that needs stop
// coordinates — nearby-stops view, "use my location" flow, search
// typeahead for GMB / NLB / MTR stops, stop-view lat/lng enrichment,
// route-view inline stop coords — and previously this fetch was
// driven eagerly by `loadIndex()` on first paint, adding ~190 KB to
// the critical-path payload of the home view.
//
// Phase 43 defers that fetch until a feature actually needs it:
//
//   - Search view: kicked off the first time `searchIndex()` runs
//     (i.e. the user types a query). Repeats are instant via the
//     in-memory + localStorage cache.
//   - Nearby / nearest-stop pill: when `state.userLoc` is set AND
//     the user is on the home or search view.
//   - Stop view / route view: when the user navigates to a stop or
//     a route detail page (so the seed name/coords enrich from the
//     index).
//   - Recent stops enrichment: same trigger as the recent-row render
//     (deferred until the user re-visits the home view with non-empty
//     recent entries).
//
// Cache strategy mirrors `routes-by-stop.js`:
//
//   - localStorage-serialized mirror under `buseta.stops.v1` (data)
//     and `buseta.stops.ts.v1` (timestamp).
//   - 7-day TTL (matches `ROUTE_STOPS_MAX_AGE_MS`).
//   - `fetch(..., { cache: 'force-cache' })` so the SW's ASSET_CACHE
//     bucket wins over the network on every call after the first
//     (the lazy-load is solely to defer the *first* fetch).
//
// Promise de-duplication: multiple concurrent callers in the same
// tick (e.g. `populateNearbyInto` + `buildNearestStopPill` both
// firing when `state.userLoc` lands) share the same in-flight
// promise so only one fetch is ever on the wire. Once cached,
// subsequent calls resolve synchronously from memory.
//
// Mirrors the dual-export pattern of `src/utils/trams.js` and
// `src/utils/routes-by-stop.js`: ESM exports for Vitest, plus a
// bottom-of-file side effect that mirrors them onto
// `globalThis.busetaUtils` for the in-browser classic-script caller
// (app.js) loaded via `<script src="src/utils/stops-cache.js?v=1">`.

const STOPS_URL = 'assets/hk-stops.json';
const STOPS_CACHE_KEY = 'buseta.stops.v1';
const STOPS_CACHE_TS_KEY = 'buseta.stops.ts.v1';
// 7-day TTL mirrors ROUTE_STOPS_MAX_AGE_MS in app.js and is short
// enough that a stale hk-stops catalogue (operators adding / removing
// stops) self-corrects without a manual cache-buster bump.
const STOPS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// In-memory cache of the most recently fetched stop catalogue.
// `null` means "never loaded", `{}` (object) means "loaded once".
// Survives across calls within the same module instance; cleared
// by `invalidateStopsCache()` so tests can force a re-fetch.
let cached = null;

// Promise of the in-flight fetch (or `null` when no fetch is in
// flight). Used to de-duplicate concurrent callers so the first
// `ensureStopsLoaded()` call in a tick shares its promise with any
// siblings that fire before the response lands.
let inflight = null;

function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' && !!localStorage;
  } catch {
    return false;
  }
}

function readLocalStorage() {
  // Returns the cached entry from localStorage if it's valid (non-null
  // object + fresh timestamp); `null` otherwise. The caller is
  // responsible for assigning it to `cached` (or for kicking off a
  // fresh fetch when this returns null).
  if (!hasLocalStorage()) return null;
  let raw;
  let tsRaw;
  try {
    raw = localStorage.getItem(STOPS_CACHE_KEY);
    tsRaw = localStorage.getItem(STOPS_CACHE_TS_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  const ts = Number(tsRaw || 0);
  if (!ts || !Number.isFinite(ts) || Date.now() - ts >= STOPS_TTL_MS) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  return parsed;
}

function writeLocalStorage(data) {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(STOPS_CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(STOPS_CACHE_TS_KEY, String(Date.now()));
  } catch {
    /* quota exceeded or storage disabled — ignore, in-memory cache still works */
  }
}

function clearLocalStorage() {
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(STOPS_CACHE_KEY);
    localStorage.removeItem(STOPS_CACHE_TS_KEY);
  } catch {
    /* ignore */
  }
}

async function fetchAndCache() {
  // `inflight` is always set to this IIFE before we run, so concurrent
  // callers land in the `if (cached) return cached` / `if (inflight) return
  // inflight` short-circuits above instead of creating fresh fetches.
  const res = await fetch(STOPS_URL, { credentials: 'omit', cache: 'force-cache' });
  if (!res.ok) {
    throw new Error(`hk-stops.json: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('hk-stops.json: response was not a JSON object');
  }
  cached = data;
  writeLocalStorage(data);
  inflight = null;
  return cached;
}

/**
 * Synchronous accessor for "do we already have the catalogue cached?".
 * Returns the parsed stops object or `null` if the catalogue has not
 * been loaded yet (either `ensureStopsLoaded()` has never been called
 * or it returned a rejected promise on the most recent attempt).
 *
 * Also consults the localStorage mirror synchronously — so a fresh
 * module instance on a return visit sees the persisted entries even
 * without an explicit `ensureStopsLoaded()` call. This is what lets
 * callers use `busetaUtils.getStops()` as a "stops are ready" guard
 * without firing a re-fetch on every cold load.
 *
 * Callers that need the catalogue NOW should prefer
 * `ensureStopsLoaded()` (returns a Promise). This accessor is for
 * read-only defensive checks (e.g. "should I render a loading hint
 * instead of a stop list?").
 *
 * @returns {Record<string, {zh: string, en: string, lat: number, lng: number}> | null}
 */
export function getStops() {
  if (cached) return cached;
  // Cold-module-in-memory but warm-localStorage: hydrate from the
  // mirror synchronously so callers don't need an explicit
  // `ensureStopsLoaded()` call to learn that we already have data.
  const stored = readLocalStorage();
  if (stored) {
    cached = stored;
    return cached;
  }
  return null;
}

/**
 * Reset all in-process and persisted state. Intended for tests:
 * Vitest doesn't have a cross-suite teardown so we expose this so
 * each `describe` block can start with a clean slate. Also handy
 * for a future "clear cached stops" debug button if one is ever
 * needed in production.
 */
export function invalidateStopsCache() {
  cached = null;
  inflight = null;
  clearLocalStorage();
}

/**
 * Ensure the stop catalogue is loaded and return it. The first call
 * fetches `/assets/hk-stops.json` (190 KB unpacked) and stashes the
 * result both in memory and in `localStorage`. Subsequent calls
 * resolve synchronously from the in-memory cache when possible,
 * falling back to localStorage when the page has been reloaded.
 *
 * Promise de-duplication: two callers racing in the same tick share
 * the same in-flight promise — only one fetch goes onto the wire.
 *
 * On HTTP non-2xx or non-object response bodies, the returned
 * Promise rejects so callers can decide whether to retry, fall back
 * to a different source, or surface a "stops unavailable" empty
 * state. The Promise rejection is intentional — silently returning
 * an empty object would hide a real deploy bug behind a fake
 * "no results" UI.
 *
 * @param {{ skipLocalStorage?: boolean }} [opts] - When `skipLocalStorage`
 *   is true, bypass the localStorage mirror and always hit the
 *   network. Useful for tests that want to exercise the fetch path
 *   without first populating localStorage. Default: false.
 * @returns {Promise<Record<string, {zh: string, en: string, lat: number, lng: number}>>}
 *   The parsed stops catalogue. Object keys are operator stop IDs
 *   (MTR station codes, GMB numeric IDs, NLB numeric IDs); values
 *   are `{ zh, en, lat, lng }` records.
 * @throws {Error} If the fetch fails or the response body is not a
 *   JSON object.
 */
export async function ensureStopsLoaded(opts = {}) {
  if (!cached && !opts.skipLocalStorage) {
    const stored = readLocalStorage();
    if (stored) cached = stored;
  }
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = fetchAndCache().catch((err) => {
    // Reset `inflight` on failure so a follow-up call can retry
    // instead of being permanently pinned to the rejected promise.
    // `cached` stays null so the next call will re-attempt the
    // network fetch (or hit the localStorage mirror if it was
    // populated by an earlier successful fetch).
    inflight = null;
    throw err;
  });
  return inflight;
}

// Constants re-exported for tests and for app.js callers that want
// to introspect the TTL / storage keys (e.g. a debug overlay).
export { STOPS_CACHE_KEY, STOPS_CACHE_TS_KEY, STOPS_TTL_MS, STOPS_URL };

// When loaded as a classic script (in index.html before app.js),
// attach the exports to globalThis.busetaUtils so app.js can call
// `busetaUtils.ensureStopsLoaded(...)`. Object.assign preserves any
// keys that were already attached by an earlier utility script.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    ensureStopsLoaded,
    getStops,
    invalidateStopsCache,
  });
}
