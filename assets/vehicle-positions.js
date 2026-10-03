/* vehicle-positions.js
 * -----------------------------------------------------------------------------
 * Best-effort live GPS lookup for Hong Kong bus / minibus routes.
 *
 * Scope: try the upstream operator feeds (KMB / CTB / GMB) that *might* expose
 * real-time vehicle positions. As of writing this comment, none of the public
 * open-data endpoints used by this app actually expose per-vehicle GPS:
 *
 *   - KMB  /v1/transport/kmb/position/...              → 422 (not enabled)
 *   - CTB  /v2/transport/citybus/position/...          → 422 (not enabled)
 *   - GMB  /eta/route-stop/{route_id}/{dir}/{stop}     → scheduled ETAs only,
 *                                                         no `gps_lat` / `gps_lng`
 *   - CTB  /v2/transport/citybus/eta/ctb/{stop}/{route} → ETAs only
 *   - KMB  /v1/transport/kmb/stop-eta/{stop}            → ETAs only
 *
 * The endpoint URLs are kept here so the moment one of them lights up, the
 * map starts showing real positions with no app-side change. Until then,
 * `fetchPositions()` resolves to `null`, and the caller falls back to the
 * placeholder "scheduled-arrival-based pseudo-position" mode documented in
 * app.js (see `renderVehicleMap` / `placeholderVehiclePositions`).
 *
 * Exposes a single global `BusEtaVehicles` namespace:
 *   - fetchPositions(co, route, dir, service, { signal }) → Promise<null>
 *   - isLive(co) → boolean                                 (always false today)
 *
 * Pure vanilla JS, no dependencies. Loaded by app.js via a plain <script> tag
 * with `defer`, so `window.BusEtaVehicles` is available before app.js boots.
 * -----------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  // The upstream bases are duplicated from app.js to keep this helper
  // standalone — if app.js's API root changes, mirror it here too.
  const KMB_BASE = 'https://data.etabus.gov.hk/v1/transport/kmb';
  const CTB_BASE = 'https://rt.data.gov.hk/v2/transport/citybus';
  const GMB_BASE = 'https://data.etagmb.gov.hk';

  // Endpoints we *might* be able to call. All currently return either 422
  // (no public GPS feed) or JSON with no GPS fields. Listed here so future
  // operators flipping the switch automatically get picked up.
  const CANDIDATES = {
    KMB: (route, dir, service) => [
      // `/position/{route}/{bound}/{service_type}` is the documented
      // signature; returned 422 at fetch time but kept in the list so a
      // future KMB open-data release transparently lights up.
      `${KMB_BASE}/position/${encodeURIComponent(route)}/${dir === 'I' ? 'I' : 'O'}/${encodeURIComponent(String(service || '1'))}`,
      `${KMB_BASE}/position/${encodeURIComponent(route)}`,
      `${KMB_BASE}/last-known-position`,
    ],
    CTB: (route /*, dir */) => [
      `${CTB_BASE}/position/ctb/${encodeURIComponent(route)}`,
      `${CTB_BASE}/position/ctb/${encodeURIComponent(route)}/inbound`,
      `${CTB_BASE}/position/ctb/${encodeURIComponent(route)}/outbound`,
    ],
    GMB: (routeId, routeSeq /*, stopSeq */) => [
      // GMB upstream exposes route-level ETAs only. No public GPS field
      // exists today; we still probe with the route_id + route_seq pair
      // in case a future field lands.
      `${GMB_BASE}/eta/route-stop/${encodeURIComponent(String(routeId))}/${encodeURIComponent(String(routeSeq))}/1`,
    ],
  };

  // Extract a position from any plausible upstream shape. Returns null if
  // none of the recognised fields are present (so the caller can fall back).
  // Recognised fields:
  //   { lat, lng }, { latitude, longitude }, { gps_lat, gps_lng },
  //   { lat, long } (Citybus stop metadata uses `long`)
  function extractPosition(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const lat = Number(raw.lat ?? raw.latitude ?? raw.gps_lat);
    const lng = Number(raw.lng ?? raw.long ?? raw.longitude ?? raw.gps_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return null; // 0,0 sentinel
    return { lat, lng };
  }

  // Walk an arbitrary upstream JSON blob and pull out any vehicle-like
  // positions. Most upstreams either return `{ data: { positions: [...] } }`
  // or `{ data: [...] }`; we tolerate both. Each item we keep gets a `co`
  // (operator) tag and the original raw row so the caller can use the
  // vehicle id / plate / heading / etc. later if needed.
  function extractPositions(blob, co) {
    if (!blob || typeof blob !== 'object') return [];
    const root = Array.isArray(blob.data) ? blob.data
      : (blob.data && Array.isArray(blob.data.positions)) ? blob.data.positions
      : (blob.data && Array.isArray(blob.data.vehicles)) ? blob.data.vehicles
      : null;
    if (!Array.isArray(root)) return [];
    const out = [];
    for (const row of root) {
      const pos = extractPosition(row);
      if (!pos) continue;
      out.push({
        co,
        lat: pos.lat,
        lng: pos.lng,
        // Best-effort identifiers / metadata. Caller may ignore these.
        id: row.id || row.vehicle_id || row.plate || row.reg || row.vehicle || null,
        bearing: (Number.isFinite(Number(row.bearing ?? row.heading)) ? Number(row.bearing ?? row.heading) : null),
        speed: (Number.isFinite(Number(row.speed)) ? Number(row.speed) : null),
        raw: row,
      });
    }
    return out;
  }

  // Probe a single URL. Returns { url, status, blob, positions } or null on
  // network failure (so we can silently skip).
  async function probe(url, co, signal) {
    try {
      const resp = await fetch(url, { signal: signal || undefined, cache: 'no-store' });
      if (!resp || !resp.ok) {
        // 422 (parameter missing) is the expected response from KMB / CTB
        // today; we swallow it quietly.
        return { url, status: resp ? resp.status : 0, blob: null, positions: [] };
      }
      const blob = await resp.json().catch(() => null);
      const positions = extractPositions(blob, co);
      return { url, status: resp.status, blob, positions };
    } catch (e) {
      // Network / CORS / parse — silently ignore.
      return null;
    }
  }

  /**
   * Probe every candidate endpoint for `co` (KMB / CTB / GMB) and return
   * the first set of positions we manage to extract. Resolves to `null`
   * if no upstream yields real positions — the caller is expected to
   * fall back to placeholder pseudo-positions based on the ETA pattern.
   *
   * @param {string} co            Operator code: 'KMB' | 'CTB' | 'GMB'.
   * @param {string} route          Route number (or GMB route code).
   * @param {string} dir            'I' (inbound) | 'O' (outbound) | '1' | '2' (GMB).
   * @param {string|number} service Service type (KMB / CTB), or GMB route_id.
   * @param {{stopSeq?: string|number, signal?: AbortSignal}} [opts]
   * @returns {Promise<null | Array<{co, lat, lng, id?, bearing?, speed?, raw?}>>}
   */
  async function fetchPositions(co, route, dir, service, opts) {
    const builder = CANDIDATES[co];
    if (!builder || !route) return null;
    // For GMB the "service" param is the route_id and the "dir" is route_seq.
    const urls = builder(route, dir, service);
    if (!Array.isArray(urls) || urls.length === 0) return null;

    // Probe all in parallel; the first one that returns positions wins.
    // We never throw — every probe resolves (possibly to an empty array).
    const signal = (opts && opts.signal) || null;
    const results = await Promise.all(urls.map((u) => probe(u, co, signal)));
    for (const r of results) {
      if (r && Array.isArray(r.positions) && r.positions.length > 0) {
        return r.positions;
      }
    }
    return null;
  }

  // Always-false flag for now. Kept so callers can write the same code path
  // today ("if (BusEtaVehicles.isLive(co)) ..."). Flips to true the day any
  // operator's endpoint actually returns positions.
  function isLive(/* co */) { return false; }

  root.BusEtaVehicles = {
    fetchPositions,
    isLive,
    // Exposed for debugging / future tests; not used by app.js.
    _internal: { probe, extractPositions, extractPosition, CANDIDATES },
  };
})(typeof window !== 'undefined' ? window : globalThis);
