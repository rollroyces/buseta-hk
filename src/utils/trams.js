// Hong Kong Tramways stop catalogue (Phase 38 stub).
//
// Trams operate on Hong Kong Island only. The official Tramways open-
// data endpoint is undocumented and has no SLA, so for Phase 38 we ship
// a curated starter set in assets/tram-stops.json (24 stops + a
// `_meta` header) that mirrors the shape of assets/mtr-stops.json so
// downstream code can treat both uniformly.
//
// Phase 39 will replace this with a live fetch helper that calls the
// Tramways endpoint. The current contract — `fetchTramStops()` returns
// `{ _meta, [stopCode]: { zh, en, lat, lng } }` or `null` on failure —
// is the one live mode will also satisfy, so app.js callers can swap
// implementations behind the same function signature.
//
// Why no upstream fetch yet?
//   - The Tramways endpoint is community-reverse-engineered (see the
//     `hongkong-trams` npm wrapper). No auth, but no SLA either.
//   - Phase 37's research doc (docs/new-operator-research.md) flags
//     this risk explicitly: ship a bundled fallback first, add a live
//     fetch as a layered enhancement, never block the starter UI on a
//     third-party endpoint.
//   - The bundled JSON lives next to mtr-stops.json + lrt-stops.json
//     and is cached by the same SW ASSET_CACHE bucket — no new
//     plumbing required.
//
// Stop codes follow the 3-letter uppercase convention used by the
// `hongkong-trams` npm wrapper (KTT, SYP, SHW, CEN, ...).

const TRAM_STOPS_URL = 'assets/tram-stops.json';

/**
 * Fetch the bundled Hong Kong Tramways stop catalogue.
 *
 * Returns the parsed JSON on success: an object whose keys are
 * 3-letter stop codes (e.g. `"KTT"`, `"SYP"`) and whose values are
 * `{ zh, en, lat, lng }` records — identical shape to mtr-stops.json.
 *
 * Returns `null` if the network call fails, the response is not JSON,
 * or the body doesn't look like a stop catalogue (no recognised keys).
 * Callers must treat `null` as "no data" — never as "empty" — so a
 * missing bundled file surfaces as an honest null rather than a fake
 * empty result that hides a deploy bug.
 *
 * Phase 39+ will add a live upstream fetch layered on top of this
 * bundled baseline. The signature is stable across that evolution.
 *
 * @returns {Promise<Record<string, { zh: string, en: string, lat: number, lng: number }> | null>}
 */
export async function fetchTramStops() {
  try {
    const res = await fetch(TRAM_STOPS_URL, { credentials: 'omit', cache: 'force-cache' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    // Shape check — at least one entry whose value has the
    // expected `{ zh, en, lat, lng }` shape. The bundled JSON has
    // 24 such entries; a future live fetch that returned an error
    // envelope would land here as `null` rather than as a confusing
    // empty object.
    const entries = Object.entries(data).filter(([k]) => k !== '_meta');
    const looksLikeStops = entries.some(
      ([, v]) =>
        v &&
        typeof v === 'object' &&
        typeof v.zh === 'string' &&
        typeof v.en === 'string' &&
        typeof v.lat === 'number' &&
        typeof v.lng === 'number'
    );
    return looksLikeStops ? data : null;
  } catch (_err) {
    return null;
  }
}

// Default-export alias for the dual-export pattern used by every
// src/utils/ module: ESM exports for Vitest + globalThis.busetaUtils
// for in-browser classic-script callers. The IIFE in index.html
// loads this via <script src="src/utils/trams.js?v=1"></script>
// and the module assigns itself onto globalThis so app.js can call
// `busetaUtils.fetchTramStops(...)` once the tram-aware UI lands in
// Phase 40.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    fetchTramStops,
  });
}
