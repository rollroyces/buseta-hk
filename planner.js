/* ------------------------------------------------------------------
 * Planner (A → B trip planner)
 *   Pure vanilla, no dependencies. Lives alongside app.js and reads
 *   the same `state.index` so it can answer queries with the same
 *   data the rest of the app already trusts.
 *
 *   Public surface (attached to `window.Planner`):
 *     - Planner.renderPlanner(viewEl)        — wire the view shell
 *     - Planner.search(originStop, destStop) — run the algorithm
 *     - Planner.recentPlannerQueries()       — recent "X → Y" entries
 *
 *   Algorithm:
 *     0-hop (direct): iterate `state.index.routes` + `ctbRoutes` and
 *                     look up route-stop lists from the operator APIs
 *                     (cached). Pick the best per route and rank by
 *                     ETA sum (walk-out + ride + walk-in).
 *     1-hop (transfer): BFS — from origin's stop-graph fan-out, find
 *                     the transfer stop S where a route serving dest
 *                     also overlaps.
 *     2-hop (transfer): same, one extra hop.
 *
 *   Speed assumptions: 60 m/min walk, 12 km/h average bus speed
 *   (configurable via SPEEDS below).
 * ------------------------------------------------------------------ */
(function () {
  'use strict';

  // ---- Tunables ---------------------------------------------------------
  const WALK_M_PER_MIN = 60;          // walking speed
  const BUS_KMH = 12;                  // average bus speed (busway included)
  const BUS_KMH_M_PER_MIN = BUS_KMH * 1000 / 60; // 200 m/min
  const TRANSFER_WALK_LIMIT_M = 500;   // reject transfer legs that need a walk > this
                                    // v51 — loosened from 350m. Some HK bus
                                    // interchanges (e.g. 大圍站公共運輸交匯處,
                                    // 黃大仙站) require a 350-500m walk between
                                    // different operators' stops; the old limit
                                    // silently filtered them out, leaving the
                                    // user with only the MTR cross-mode option
                                    // for legitimate KMB↔KMB transfers.
  const ORIGIN_WALK_LIMIT_M    = 1200; // walking from origin to first stop
  const DEST_WALK_LIMIT_M      = 1200;
  const ETA_MAX_MIN            = 120;  // ignore ETAs further out than this
  const CONCURRENCY            = 16;   // API concurrency cap (browsers tolerate 16 per origin)
  const DIRECT_LIMIT           = 5;
  const ONE_TRANSFER_LIMIT     = 5;
  const TWO_TRANSFER_LIMIT     = 3;
  // v41 — route strategies (Bus / Rail / Mixed). Each strategy is computed
  // by a different sub-planner running on different candidate sets, so
  // showing the top N of each gives the user genuinely different routes
  // to compare. We slice the per-strategy bucket down to STRATEGY_LIMIT so
  // the results view stays scannable (top 1–2 per strategy is plenty).
  const STRATEGY_LIMIT         = 2;

  // ---- Module state ----------------------------------------------------
  // Per-stop route list cache. We don't pre-build the whole graph (≈600
  // routes × 30 stops = a lot of upstream calls). Instead we lazily fetch
  // route-stop lists for routes that touch origin / destination / transfer
  // candidates as we go. We also keep a `stopId → [routeKey]` reverse
  // index so subsequent 1-/2-hop searches are cheap.
  const _routeStopsCache = new Map();        // routeKey -> [{ stop, seq, lat, lng }]
  const _stopRoutesCache = new Map();        // stopId -> Set(routeKey)  (reverse index)
  const _routeAccess     = new Map();        // routeKey -> Date.now() of last cache hit/miss
  let   _adjacencyCache  = new WeakMap();    // state.index -> { stops: Map(stopId -> [{ toStop, routeKey, km }]) }
  let   _indexVersion    = 0;

  // ---- Persisted cache (localStorage) ---------------------------------
  // Persist a compact version of `_routeStopsCache` + `_stopRoutesCache`
  // so the second visit paints instantly. We use a short, versioned key
  // so future schema changes can invalidate it by bumping the suffix.
  const CACHE_KEY        = 'buseta.planner.adj.v1';
  const CACHE_MAX_ROUTES = 400;        // soft cap; evicts oldest beyond this
  const CACHE_MAX_BYTES  = 4_500_000;  // ~4.5 MB — under the localStorage limit
  let   _cacheLoaded     = false;
  let   _cacheDirty      = false;
  let   _cacheSaveTimer  = null;

  function loadPersistedCache() {
    if (_cacheLoaded) return;
    _cacheLoaded = true;
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (!obj || obj.v !== 1) return;
      if (obj.rs && typeof obj.rs === 'object') {
        for (const k of Object.keys(obj.rs)) {
          const arr = obj.rs[k];
          if (!Array.isArray(arr)) continue;
          const norm = [];
          for (const it of arr) {
            if (!it || typeof it.s !== 'string') continue;
            norm.push({
              stop: it.s,
              seq: Number.isFinite(it.q) ? it.q : 0,
              lat: Number.isFinite(it.la) ? it.la : null,
              lng: Number.isFinite(it.ln) ? it.ln : null,
              nameTc: it.n || '',
              nameEn: it.e || '',
            });
          }
          if (norm.length > 0) _routeStopsCache.set(k, norm);
        }
      }
      if (obj.sr && typeof obj.sr === 'object') {
        for (const sid of Object.keys(obj.sr)) {
          const arr = obj.sr[sid];
          if (!Array.isArray(arr)) continue;
          _stopRoutesCache.set(sid, new Set(arr));
        }
      }
    } catch (e) {
      // Bad JSON or quota exceeded — discard silently.
    }
  }

  function schedulePersistCache() {
    _cacheDirty = true;
    if (_cacheSaveTimer) return;
    _cacheSaveTimer = setTimeout(() => {
      _cacheSaveTimer = null;
      if (_cacheDirty) persistCacheNow();
    }, 4000);
  }

  function persistCacheNow() {
    _cacheDirty = false;
    try {
      // Build the compact payload. Drop oldest entries if we exceed
      // CACHE_MAX_ROUTES so we stay well under the localStorage cap.
      const keys = Array.from(_routeStopsCache.keys());
      let keepKeys = keys;
      if (keys.length > CACHE_MAX_ROUTES) {
        const sorted = keys.slice().sort(
          (a, b) => (_routeAccess.get(a) || 0) - (_routeAccess.get(b) || 0));
        keepKeys = sorted.slice(sorted.length - CACHE_MAX_ROUTES);
        // Evict the dropped routes from both caches.
        for (const k of keys) {
          if (!keepKeys.includes(k)) _routeStopsCache.delete(k);
        }
        // Rebuild reverse index incrementally.
        const stopRev = new Map();
        for (const k of keepKeys) {
          const stops = _routeStopsCache.get(k);
          if (!stops) continue;
          for (const s of stops) {
            if (!stopRev.has(s.stop)) stopRev.set(s.stop, new Set());
            stopRev.get(s.stop).add(k);
          }
        }
        _stopRoutesCache.clear();
        for (const [sid, set] of stopRev) _stopRoutesCache.set(sid, set);
      }

      const rs = {};
      let bytes = 0;
      for (const k of keepKeys) {
        const arr = _routeStopsCache.get(k);
        if (!arr) continue;
        const slim = arr.map((it) => ({
          s: it.stop, q: it.seq,
          la: Number.isFinite(it.lat) ? it.lat : null,
          ln: Number.isFinite(it.lng) ? it.lng : null,
          n: it.nameTc || '', e: it.nameEn || '',
        }));
        const json = JSON.stringify(slim);
        bytes += json.length;
        if (bytes > CACHE_MAX_BYTES) break;
        rs[k] = slim;
      }
      const sr = {};
      for (const [sid, set] of _stopRoutesCache) sr[sid] = Array.from(set);
      const payload = JSON.stringify({ v: 1, rs, sr });
      window.localStorage.setItem(CACHE_KEY, payload);
    } catch (e) {
      // QuotaExceededError etc. — silently drop. The next warm start will
      // simply re-fetch.
    }
  }

  // Best-effort: load before the first renderPlanner so warm-start
  // searches can use the persisted reverse index immediately.
  loadPersistedCache();

  // ---- Request counter (for instrumentation) ---------------------------
  // Reset at the start of every Planner.search() and read inside `search()`
  // for the timing log. Cheap and process-local.
  let _reqCounter = 0;
  function _bumpReq() { _reqCounter++; }
  function _resetReq() { _reqCounter = 0; }

  function invalidateCaches() {
    _routeStopsCache.clear();
    _stopRoutesCache.clear();
    _routeAccess.clear();
    _adjacencyCache = new WeakMap();
    _indexVersion++;
    // Drop the persisted snapshot too — the next cold start rebuilds it.
    try { window.localStorage.removeItem(CACHE_KEY); } catch (e) {}
    _cacheLoaded = false;
    _cacheDirty = false;
    // Rail graphs are built once per index lifetime; drop them too so a
    // freshly-rehydrated index rebuilds from the new line/stop data.
    invalidateRailGraphs();
  }

  // Pick the right "stop-route" fetcher for a given operator stop id.
  // We don't have a /stop/route endpoint for KMB, so we use
  // fetchKmbRouteStop via the local index (we only know the routes that
  // touch a stop by enumerating routes and checking the stop list).
  // The GMB operator has a /stop-route endpoint which is much cheaper.

  // Small helper: bound-concurrency fetcher (mirrors fetchStopsWithCap).
  async function mapWithCap(items, cap, worker) {
    const out = new Array(items.length);
    if (items.length === 0) return out;
    const limit = Math.max(1, Math.min(cap, items.length));
    let cursor = 0;
    const inFlight = new Set();
    const pump = () => {
      while (inFlight.size < limit && cursor < items.length) {
        const i = cursor++;
        const p = (async () => {
          try { out[i] = { ok: true, value: await worker(items[i], i) }; }
          catch (e) { out[i] = { ok: false, error: e }; }
        })();
        inFlight.add(p);
        p.finally(() => inFlight.delete(p));
      }
    };
    pump();
    while (inFlight.size > 0 || cursor < items.length) {
      if (inFlight.size === 0) pump();
      await Promise.race([...inFlight]);
      pump();
    }
    return out;
  }

  // Haversine (mirrors app.js, kept self-contained).
  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = (x) => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function walkMinutes(meters) {
    return meters / WALK_M_PER_MIN;
  }
  function rideMinutes(meters) {
    return meters / BUS_KMH_M_PER_MIN;
  }

  // ---- v47 — Real walking path via public GraphHopper demo ------------
  // The flat 60 m/min haversine estimate (walkMinutes above) is fast but
  // inaccurate for HK: it ignores elevation, ferry crossings, the fact
  // that you can't walk straight through the harbour, etc. The public
  // GraphHopper demo at routing.openstreetmap.de answers with a real
  // pedestrian route — duration / distance + a GeoJSON LineString —
  // without any API key. Verified TSW → CEN returns 14.9 km / 11,596 s
  // (193 min) vs the flat 248 min haversine estimate, with 916 waypoints.
  //
  // Public demo is fair-use. Cache aggressively (rounded coords ~1 m
  // precision) so back-to-back searches don't hammer the demo. On any
  // failure we fall back to walkMinutes() so the planner still works.
  const _walkRouteCache = new Map();   // "lat,lng|lat,lng" → {meters, seconds, geometry} | null
  const WALK_ROUTE_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
  async function fetchRealWalkRoute(lat1, lng1, lat2, lng2) {
    if (!Number.isFinite(lat1) || !Number.isFinite(lng1) ||
        !Number.isFinite(lat2) || !Number.isFinite(lng2)) return null;
    // Skip trivial distances (<50 m straight-line) — no routing value.
    if (haversine(lat1, lng1, lat2, lng2) < 0.05) return null;
    const k1 = `${lat1.toFixed(5)},${lng1.toFixed(5)}`;
    const k2 = `${lat2.toFixed(5)},${lng2.toFixed(5)}`;
    const key = `${k1}>${k2}`;
    if (_walkRouteCache.has(key)) return _walkRouteCache.get(key);
    try {
      const url = `${WALK_ROUTE_URL}${lng1.toFixed(5)},${lat1.toFixed(5)};${lng2.toFixed(5)},${lat2.toFixed(5)}` +
                  `?overview=full&geometries=geojson&steps=false&alternatives=false`;
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 2500);
      let resp;
      try {
        resp = await fetch(url, { signal: ctl.signal });
      } finally { clearTimeout(timer); }
      if (!resp.ok) { _walkRouteCache.set(key, null); return null; }
      const j = await resp.json();
      if (j.code !== 'Ok' || !j.routes || !j.routes[0]) {
        _walkRouteCache.set(key, null); return null;
      }
      const route = j.routes[0];
      const out = {
        meters: route.distance,
        seconds: route.duration,
        // GeoJSON: each coord is [lng, lat] — flip to {lat, lng} for the
        // canvas projector, which expects lat-first.
        geometry: (route.geometry && route.geometry.coordinates || []).map((c) => ({ lat: c[1], lng: c[0] })),
      };
      _walkRouteCache.set(key, out);
      return out;
    } catch (e) {
      _walkRouteCache.set(key, null);
      return null;
    }
  }
  // Wraps fetchRealWalkRoute with the existing haversine fallback so the
  // walk-leg construction in every router is one line:
  //   const w = await walkLeg(lat1, lng1, lat2, lng2);
  //   // w.meters  {w.minutes  {w.geometry: [{lat,lng}...] | null}  {w.routed: bool}
  async function walkLeg(lat1, lng1, lat2, lng2) {
    const real = await fetchRealWalkRoute(lat1, lng1, lat2, lng2);
    if (real) {
      return {
        meters: real.meters,
        minutes: real.seconds / 60,
        geometry: real.geometry,
        routed: true,
      };
    }
    const m = haversine(lat1, lng1, lat2, lng2) * 1000;
    return { meters: m, minutes: walkMinutes(m), geometry: null, routed: false };
  }
  function totalKm(legs) {
    let m = 0;
    legs.forEach((l) => {
      if (l.kind === 'walk') m += l.meters || 0;
      else if (l.kind === 'ride') m += l.meters || 0;
    });
    return m;
  }

  // Round helper that prefers integer minutes but keeps "0" for trivial hops.
  function mins(x) { return Math.max(1, Math.round(x)); }

  // Pretty distance "320 m" / "1.4 km".
  function fmtDistance(m) {
    if (!Number.isFinite(m)) return '';
    if (m < 1) return '0 m';
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(1)} km`;
  }

  // ---- depart-by mode helpers ---------------------------------------
  // Format a Date as HH:MM (24h, zero-padded) for `<input type="time">` and
  // for journey card sub-labels.
  function formatHHMM(date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // Parse the `<input type="time">` value ("HH:MM") into a Date set on
  // today's calendar day. Returns null on bad input.
  function parseTargetTime(value) {
    if (!value || typeof value !== 'string') return null;
    const m = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    return d;
  }

  // Work backward from the target arrival date by `totalMin` minutes.
  // Returns null on bad input.
  function computeDepartureTime(targetDate, totalMin) {
    if (!targetDate || !Number.isFinite(totalMin)) return null;
    return new Date(targetDate.getTime() - totalMin * 60000);
  }

  // ---- Index helpers --------------------------------------------------
  // Return all routeKeys whose `service` key in the global index matches.
  function allRouteKeys(idx) {
    const out = [];
    idx.routes.forEach((_v, k) => out.push(k));
    idx.ctbRoutes.forEach((_v, k) => out.push(k));
    return out;
  }

  // Fetch (and cache) the stop list of a route.
  // Optional `hintMeta` is used when the routeKey isn't in the global
  // index (e.g. inbound CTB routes, which the index only stores as 'O').
  async function getRouteStops(idx, routeKey, hintMeta) {
    if (_routeStopsCache.has(routeKey)) {
      _routeAccess.set(routeKey, Date.now());
      return _routeStopsCache.get(routeKey);
    }

    const meta = idx.routes.get(routeKey) || idx.ctbRoutes.get(routeKey) || hintMeta || null;
    if (!meta) return null;

    let rawStops = null;
    try {
      if (meta.co === 'CTB' || meta.co === 'NWFB') {
        const resp = await fetch(`https://rt.data.gov.hk/v2/transport/citybus/route-stop/${encodeURIComponent(meta.co.toLowerCase())}/${encodeURIComponent(meta.route)}/${meta.dir === 'I' ? 'inbound' : 'outbound'}`);
        _bumpReq();
        if (resp.ok) {
          const j = await resp.json();
          if (Array.isArray(j.data)) rawStops = j.data;
        }
      } else if (meta.co === 'KMB' || meta.co === 'LWB') {
        const resp = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${encodeURIComponent(meta.route)}/${meta.dir === 'I' ? 'inbound' : 'outbound'}/${encodeURIComponent(meta.service)}`);
        _bumpReq();
        if (resp.ok) {
          const j = await resp.json();
          if (Array.isArray(j.data)) rawStops = j.data;
        }
      } else if (meta.co === 'GMB') {
        // GMB routes use region-code names in the index. Skip for now —
        // GMB minibus searches can be added once the GMB route index
        // is fully enriched (the parent app does this lazily).
        rawStops = null;
      }
    } catch (e) {
      rawStops = null;
    }

    const stops = [];
    if (rawStops) {
      rawStops
        .map((it) => {
          const known = idx.stops.get(String(it.stop));
          const lat = known && Number.isFinite(known.lat) ? known.lat : null;
          const lng = known && Number.isFinite(known.lng) ? known.lng : null;
          return {
            stop: String(it.stop),
            seq: parseInt(it.seq, 10),
            lat, lng,
            nameTc: known ? known.nameTc : '',
            nameEn: known ? known.nameEn : '',
          };
        })
        .filter((x) => Number.isFinite(x.seq))
        .sort((a, b) => a.seq - b.seq)
        .forEach((x) => stops.push(x));
    }
    _routeStopsCache.set(routeKey, stops);
    _routeAccess.set(routeKey, Date.now());
    schedulePersistCache();
    // Reverse index update.
    stops.forEach((s) => {
      if (!_stopRoutesCache.has(s.stop)) _stopRoutesCache.set(s.stop, new Set());
      _stopRoutesCache.get(s.stop).add(routeKey);
    });
    return stops;
  }

  // ---- Per-stop route list (KMB / CTB shortcut) -----------------------
  // KMB /stop-eta/{stopId} and CTB /batch/stop-eta/CTB/{stopId} both return
  // every route serving a given stop in a single call. This is the key
  // optimization: instead of fanning out one request per route, we ask
  // "what routes serve stop X?" and get back ~5–15 entries in one HTTP
  // round-trip. Combined with the cached route-stop list, this drops a
  // cold-start direct search from ~1100 upstream calls to ~10–30.
  function classifyStopId(stopId) {
    const s = String(stopId);
    if (/^[0-9a-fA-F]{16}$/.test(s)) return 'KMB';
    if (/^[0-9]{6}$/.test(s))       return 'CTB';
    if (/^[A-Za-z]{3,4}$/.test(s))  return 'MTR';
    if (/^[0-9]{1,3}$/.test(s))     return 'LRT';
    return 'OTHER';
  }

  async function fetchKmbStopEtaMeta(stopId) {
    try {
      const resp = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${encodeURIComponent(stopId)}`);
      _bumpReq();
      if (!resp.ok) return [];
      const j = await resp.json();
      const data = Array.isArray(j.data) ? j.data : [];
      const seen = new Set();
      const out = [];
      for (const e of data) {
        const co = e.co || 'KMB';
        const route = String(e.route);
        const dir = String(e.dir);
        const service = String(e.service_type);
        const key = `${co}|${route}|${dir}|${service}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ co, route, dir, service });
      }
      return out;
    } catch (e) {
      return [];
    }
  }

  async function fetchCtbStopEtaMeta(stopId) {
    try {
      const resp = await fetch(`https://rt.data.gov.hk/v1/transport/batch/stop-eta/CTB/${encodeURIComponent(stopId)}`);
      _bumpReq();
      if (!resp.ok) return [];
      const j = await resp.json();
      const data = Array.isArray(j.data) ? j.data : [];
      const seen = new Set();
      const out = [];
      for (const e of data) {
        const co = 'CTB';
        const route = String(e.route);
        const dir = String(e.dir);
        const service = '1';
        const key = `${co}|${route}|${dir}|${service}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ co, route, dir, service });
      }
      return out;
    } catch (e) {
      return [];
    }
  }

  // Returns an array of `{ co, route, dir, service }` objects describing
  // every route serving `stopId`. Empty array for stops whose operator
  // doesn't expose a per-stop shortcut (MTR / LRT / GMB).
  async function fetchRoutesServingStop(stopId) {
    const op = classifyStopId(stopId);
    if (op === 'KMB') return await fetchKmbStopEtaMeta(stopId);
    if (op === 'CTB') return await fetchCtbStopEtaMeta(stopId);
    return [];
  }

  // Return all routes that touch a given stop (uses the reverse index).
  function routesServingStop(stopId) {
    return _stopRoutesCache.has(stopId)
      ? Array.from(_stopRoutesCache.get(stopId))
      : [];
  }

  // Stop meta lookup with operator stop id fallback.
  function stopMeta(idx, stopId) {
    if (idx.stops.has(stopId)) return idx.stops.get(stopId);
    if (idx.mtr && idx.mtr.has(stopId)) return idx.mtr.get(stopId);
    return null;
  }

  function stopName(idx, stopId) {
    const s = stopMeta(idx, stopId);
    if (!s) return stopId;
    if (window.state && window.state.lang === 'en') return s.nameEn || s.nameTc || stopId;
    if (window.state && window.state.lang === 'zh-Hans') return s.nameSc || s.nameTc || s.nameEn || stopId;
    return s.nameTc || s.nameSc || s.nameEn || stopId;
  }

  function stopLatLng(idx, stopId) {
    // v48.3 — prefer idx.mtr over idx.stops for an MTR station code.
    // hk-stops.json (curated) and mtr-stops.json (official) disagree on a
    // few lat/lng values (e.g. MOS: mtr=22.424979/114.231492 vs
    // hk=22.42491/114.23198, a 60 m discrepancy). When a station appears
    // in both, the MTR router uses the idx.mtr entry (built from
    // mtr-lines.json + mtr-stops.json) and expects the matching
    // destLL/railDest lat/lng — but stopMeta historically checked
    // idx.stops first. Letting idx.mtr take over for MTR codes keeps the
    // router's geometry in lock-step with the ride graph.
    if (idx.mtr && idx.mtr.has(stopId)) {
      const s = idx.mtr.get(stopId);
      if (s._isLine) {
        // fall through to idx.stops
      } else if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) {
        return { lat: s.lat, lng: s.lng };
      }
    }
    const s = stopMeta(idx, stopId);
    if (!s) return null;
    if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) return { lat: s.lat, lng: s.lng };
    return null;
  }

  // Get the on-route km distance between two stops on the same route.
  function routeDistanceKm(stops, aSeq, bSeq) {
    const lo = Math.min(aSeq, bSeq), hi = Math.max(aSeq, bSeq);
    let m = 0;
    for (let i = lo; i < hi; i++) {
      const a = stops[i], b = stops[i + 1];
      if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) continue;
      m += haversine(a.lat, a.lng, b.lat, b.lng) * 1000;
    }
    return m / 1000;
  }

  // Compute the walk minutes from an arbitrary (lat,lng) point to a stop.
  function walkMinutesTo(lat, lng, idx, stopId) {
    const ll = stopLatLng(idx, stopId);
    if (!ll || !Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity;
    return walkMinutes(haversine(lat, lng, ll.lat, ll.lng) * 1000);
  }

  // ---- v48 — cross-mode nearest-rail-station lookup ------------------
  // v43 relaxed the bus sub-planners to fire only when one or both stops
  // are non-rail; v47 added real walking paths via walkLeg. v48 stitches
  // them together: when the user types MTR↔KMB (or LRT↔KMB), route the
  // rail side to the *nearest* rail station to the KMB side and append
  // a walkLeg from that station to the actual destination. Returns
  // { code, lat, lng, distMeters } sorted ascending, capped to within
  // maxMeters of the requested coordinate. `null` if nothing's close.
  //
  // Cached by rounded coords (~1 m precision) and operator so a back-to-
  // back planner query (e.g. swap button) doesn't re-scan the index.
  const _nearestRailCache = new Map();  // key → array
  function _railCacheKey(marker, lat, lng, maxM) {
    // ~1 m precision at HK latitudes — adequate for station selection.
    return `${marker}|${Math.round(lat * 10000) / 10000}|${Math.round(lng * 10000) / 10000}|${Math.round(maxM)}`;
  }
  function findNearestMtrStop(idx, lat, lng, maxMeters) {
    if (!idx || !idx.mtr) return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const max = Number.isFinite(maxMeters) ? maxMeters : DEST_WALK_LIMIT_M;
    const cacheKey = _railCacheKey('MTR', lat, lng, max);
    if (_nearestRailCache.has(cacheKey)) return _nearestRailCache.get(cacheKey);
    const out = [];
    idx.mtr.forEach((s, code) => {
      if (s._isLine) return;
      const sLat = Number.isFinite(s.lat) ? s.lat : null;
      const sLng = Number.isFinite(s.lng) ? s.lng : null;
      if (sLat == null || sLng == null) return;
      const d = haversine(lat, lng, sLat, sLng) * 1000;
      if (d > max) return;
      out.push({ code, lat: sLat, lng: sLng, distMeters: d });
    });
    out.sort((a, b) => a.distMeters - b.distMeters);
    _nearestRailCache.set(cacheKey, out);
    return out;
  }
  function findNearestLrtStop(idx, lat, lng, maxMeters) {
    if (!idx || !idx.lrt || !idx.lrt.stops) return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const max = Number.isFinite(maxMeters) ? maxMeters : DEST_WALK_LIMIT_M;
    const cacheKey = _railCacheKey('LRT', lat, lng, max);
    if (_nearestRailCache.has(cacheKey)) return _nearestRailCache.get(cacheKey);
    const out = [];
    idx.lrt.stops.forEach((s, code) => {
      if (s._isLine) return;
      const sLat = Number.isFinite(s.lat) ? s.lat : null;
      const sLng = Number.isFinite(s.lng) ? s.lng : null;
      if (sLat == null || sLng == null) return;
      const d = haversine(lat, lng, sLat, sLng) * 1000;
      if (d > max) return;
      out.push({ code, lat: sLat, lng: sLng, distMeters: d });
    });
    out.sort((a, b) => a.distMeters - b.distMeters);
    _nearestRailCache.set(cacheKey, out);
    return out;
  }
  // ---- v52.2 — Nearest bus stop lookup -------------------------------
  // Used by buildMixedJourneys when the rail entry/exit is an MTR or LRT
  // station code (3-letter or numeric), which never appears in a bus route's
  // stop list. findDirect() iterates each candidate route's stops and does
  // an exact `s.stop === dest.stop` check, so passing MTR as the literal
  // findDirect dest yields zero candidates. Instead we resolve the closest
  // KMB / LWB / CTB / NWFB / GMB stop within walking distance (~500 m) and
  // use that as the findDirect dest; the extra walk from the bus-alighting
  // stop to the actual rail station is then appended as a separate leg in
  // the spliced mixed journey.
  const _nearestBusCache = new Map();  // cacheKey → { stop, lat, lng, distMeters } | null
  function _busCacheKey(lat, lng, maxM) {
    return `${Math.round(lat * 10000) / 10000}|${Math.round(lng * 10000) / 10000}|${Math.round(maxM)}`;
  }
  function findNearestBusStop(idx, lat, lng, maxMeters) {
    if (!idx || !idx.stops) return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const max = Number.isFinite(maxMeters) ? maxMeters : 500;
    const cacheKey = _busCacheKey(lat, lng, max);
    if (_nearestBusCache.has(cacheKey)) return _nearestBusCache.get(cacheKey);
    let best = null;
    let bestDist = Infinity;
    idx.stops.forEach((s, stopId) => {
      const co = s && s.co;
      if (co !== 'KMB' && co !== 'LWB' && co !== 'CTB' && co !== 'NWFB' && co !== 'GMB') return;
      const sLat = Number.isFinite(s.lat) ? s.lat : null;
      const sLng = Number.isFinite(s.lng) ? s.lng : null;
      if (sLat == null || sLng == null) return;
      const d = haversine(lat, lng, sLat, sLng) * 1000;
      if (d > max) return;
      if (d < bestDist) {
        bestDist = d;
        best = { stop: stopId, lat: sLat, lng: sLng, distMeters: d };
      }
    });
    _nearestBusCache.set(cacheKey, best);
    return best;
  }

  // Stitch a real walking leg onto the end (or start) of an array of
  // rail-router journeys. Used by v48 to bridge cross-mode destinations
  // (e.g. HOK → MOS rail ride → 350 m walk to MA180 KMB stop). Recomputes
  // totalMin and reclassifies the journey kind so the merged buckets in
  // search() stay accurate.
  async function appendCrossModeWalk(journeys, fromLL, toLL, toStop) {
    if (!fromLL || !toLL || !Number.isFinite(toLL.lat) || !Number.isFinite(toLL.lng)) return;
    const w = await walkLeg(fromLL.lat, fromLL.lng, toLL.lat, toLL.lng);
    const leg = {
      kind: 'walk',
      from: fromLL.stop,
      to: toStop,
      meters: w.meters,
      minutes: w.minutes,
      geometry: w.geometry,
      routed: w.routed,
    };
    journeys.forEach((j) => {
      if (!j || !j.legs) return;
      j.legs.push(leg);
      j.totalMin = j.legs.reduce((s, l) => s + (Number.isFinite(l.minutes) ? l.minutes : 0), 0);
      const transfers = j.legs.filter((l) => l.kind === 'walk' && l.transfer).length;
      j.kind = transfers === 0 ? 'direct' : (transfers === 1 ? 'one' : 'two');
    });
  }

  // ---- ETA hint (live arrivals at a stop, for the first hop) ----------
  // Try to enrich the first ride with a live ETA hint. Returns minutes
  // until the *next* arrival matching `route`, or null.
  async function fetchEtaForStopRoute(stopId, route, dir, service) {
    try {
      // CTB / NWFB use the 6-digit numeric stop id.
      if (/^[0-9]{6}$/.test(String(stopId))) {
        const resp = await fetch(`https://rt.data.gov.hk/v2/transport/citybus/eta/ctb/${encodeURIComponent(stopId)}/${encodeURIComponent(route)}`);
        if (!resp.ok) return null;
        const j = await resp.json();
        const data = Array.isArray(j.data) ? j.data : [];
        const matching = data.filter((e) => e.route === route && (dir == null || e.dir === dir));
        if (matching.length === 0) return null;
        const soonest = matching
          .map((e) => ({ eta: e.eta, t: new Date(e.eta).getTime() }))
          .filter((x) => Number.isFinite(x.t) && x.t > Date.now() - 60_000)
          .sort((a, b) => a.t - b.t)[0];
        if (!soonest) return null;
        return Math.max(0, Math.round((soonest.t - Date.now()) / 60000));
      }
      // KMB / LWB hex stop id.
      const resp = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${encodeURIComponent(stopId)}`);
      if (!resp.ok) return null;
      const j = await resp.json();
      const data = Array.isArray(j.data) ? j.data : [];
      const matching = data.filter((e) => e.route === route
        && (dir == null || e.dir === dir)
        && (service == null || String(e.service_type) === String(service)));
      if (matching.length === 0) return null;
      const soonest = matching
        .map((e) => ({ eta: e.eta, t: new Date(e.eta).getTime() }))
        .filter((x) => Number.isFinite(x.t) && x.t > Date.now() - 60_000)
        .sort((a, b) => a.t - b.t)[0];
      if (!soonest) return null;
      return Math.max(0, Math.round((soonest.t - Date.now()) / 60000));
    } catch (e) {
      return null;
    }
  }

  // ---- Route label helpers -------------------------------------------
  function routeLabel(meta) {
    if (!meta) return '';
    if (meta.co === 'GMB') {
      return meta.route;
    }
    return `${meta.route} → ${meta.destTc || meta.destEn || ''}`;
  }

  // Pick a single representative route variant (the first matching dir/service)
  // from the index. We collapse service_type variants because the planner
  // cares about the physical route shape, not school-day specials.
  function collapseRouteVariants(idx) {
    const seen = new Map();
    function consider(meta) {
      const key = `${meta.co}|${meta.route}|${meta.dir}`;
      const prior = seen.get(key);
      if (!prior) { seen.set(key, meta); return; }
      // Prefer the regular service over school specials (service === '1').
      const priorIsReg = String(prior.service) === '1';
      const curIsReg = String(meta.service) === '1';
      if (curIsReg && !priorIsReg) seen.set(key, meta);
    }
    idx.routes.forEach((m) => consider(m));
    idx.ctbRoutes.forEach((m) => consider(m));
    return Array.from(seen.values());
  }

  // ---- Direct (0-transfer) search -----------------------------------
  // Inverted-lookup strategy: ask "what routes serve origin / dest?"
  // via the KMB /stop-eta and CTB /batch/stop-eta APIs, then iterate
  // ONLY that candidate set (~5–30 routes) instead of the full ~1100
  // variants. Each candidate's stop list is served from the cache when
  // warm (hydrated from localStorage on script load).
  async function findDirect(idx, origin, dest) {
    // 1. Build candidate set via per-stop shortcuts. Both per-stop calls
    //    run in parallel — combined RTT is max(orig, dest) rather than sum.
    const [originRoutes, destRoutes] = await Promise.all([
      fetchRoutesServingStop(origin.stop),
      fetchRoutesServingStop(dest.stop),
    ]);

    const candidateMap = new Map(); // routeKey -> meta (prefer index meta for label fields)
    const addOne = (m) => {
      const k = `${m.co}|${m.route}|${m.dir}|${m.service}`;
      if (candidateMap.has(k)) return;
      const idxMeta = idx.routes.get(k) || idx.ctbRoutes.get(k);
      candidateMap.set(k, idxMeta || m);
    };
    originRoutes.forEach(addOne);
    destRoutes.forEach(addOne);

    // 2. Fall back to the legacy variant enumeration only when neither
    //    stop exposes a per-stop shortcut (MTR / LRT / GMB stops). This
    //    preserves correctness while keeping the optimised path as the
    //    fast default.
    let items;
    if (candidateMap.size > 0) {
      items = Array.from(candidateMap.values());
    } else {
      items = collapseRouteVariants(idx);
    }

    const results = await mapWithCap(items, CONCURRENCY, async (meta) => {
      const key = `${meta.co}|${meta.route}|${meta.dir}|${meta.service}`;
      const stops = await getRouteStops(idx, key, meta);
      if (!stops || stops.length === 0) return null;
      const oIdx = stops.findIndex((s) => s.stop === origin.stop);
      const dIdx = stops.findIndex((s) => s.stop === dest.stop);
      if (oIdx < 0 || dIdx < 0 || dIdx <= oIdx) return null;
      const rideKm = routeDistanceKm(stops, oIdx, dIdx);
      const rideMin = rideMinutes(rideKm * 1000);
      // v47 — real walking path via walkLeg() (GraphHopper demo, haversine
      // fallback). Each router awaits its own walks; routers run in parallel
      // via Promise.all in search(), so the GraphHopper RTT (~250 ms)
      // stacks with the slowest router, not every router.
      const oLL = stopLatLng(idx, origin.stop);
      const dLL = stopLatLng(idx, dest.stop);
      const walkOut = oLL ? await walkLeg(origin.lat, origin.lng, oLL.lat, oLL.lng) : { meters: 0, minutes: 0, geometry: null, routed: false };
      const walkIn  = dLL ? await walkLeg(dest.lat, dest.lng, dLL.lat, dLL.lng) : { meters: 0, minutes: 0, geometry: null, routed: false };
      if (walkOut.meters > ORIGIN_WALK_LIMIT_M) return null;
      if (walkIn.meters  > DEST_WALK_LIMIT_M)   return null;
      const legs = [
        { kind: 'walk', from: 'origin', to: origin.stop,
          meters: walkOut.meters, minutes: walkOut.minutes,
          geometry: walkOut.geometry, routed: walkOut.routed },
        { kind: 'ride', routeKey: key, routeMeta: meta, from: origin.stop, to: dest.stop, meters: rideKm * 1000, minutes: rideMin },
        { kind: 'walk', from: dest.stop, to: 'dest',
          meters: walkIn.meters, minutes: walkIn.minutes,
          geometry: walkIn.geometry, routed: walkIn.routed },
      ];
      return {
        kind: 'direct',
        totalMin: walkOut.minutes + rideMin + walkIn.minutes,
        legs,
        routeKey: key,
        routeMeta: meta,
      };
    });

    return results
      .filter((r) => r && r.value)
      .map((r) => r.value)
      .sort((a, b) => a.totalMin - b.totalMin)
      .slice(0, DIRECT_LIMIT);
  }

  // ---- Build a coarser stopId → {lat, lng} map for the index ----------
  function buildStopCoords(idx) {
    const m = new Map();
    idx.stops.forEach((s, k) => {
      if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) m.set(k, { lat: s.lat, lng: s.lng });
    });
    return m;
  }

  // ---- 1-transfer BFS ------------------------------------------------
  // - origin: a stopId (the user's pick)
  // - dest:   a stopId
  // For each route that touches origin: pick alight stops that ALSO
  // appear on a route that touches dest. The transfer is the alight stop.
  async function findOneTransfer(idx, origin, dest) {
    const originStop = origin.stop;
    const destStop = dest.stop;

    // First-hop candidates: routes serving origin. Use the reverse index
    // when it's warm; otherwise fall back to the per-stop shortcut so we
    // don't iterate all ~1100 routes on cold start.
    let routesFromOrigin = routesServingStop(originStop);
    if (routesFromOrigin.length === 0) {
      const shortcut = await fetchRoutesServingStop(originStop);
      routesFromOrigin = shortcut.map((m) => `${m.co}|${m.route}|${m.dir}|${m.service}`);
      // Pre-warm the cache for these candidates so the BFS below can hit
      // the route-stop lists without redundant fetches.
      await mapWithCap(shortcut, CONCURRENCY, async (m) => {
        const k = `${m.co}|${m.route}|${m.dir}|${m.service}`;
        await getRouteStops(idx, k, m);
      });
      if (routesFromOrigin.length === 0) return [];
    }

    // Fetch the stop list of every route that touches origin.
    const enriched = await mapWithCap(routesFromOrigin, CONCURRENCY, async (rk) => {
      const stops = await getRouteStops(idx, rk);
      if (!stops || stops.length === 0) return null;
      const oIdx = stops.findIndex((s) => s.stop === originStop);
      if (oIdx < 0) return null;
      return { rk, meta: idx.routes.get(rk) || idx.ctbRoutes.get(rk), stops, oIdx };
    });

    const candidates = [];
    // v47 — converted from `.forEach` to a `for..of` loop so the inner
    // `await walkLeg(...)` is legal. forEach doesn't propagate async; the
    // `await` token threw a SyntaxError on parse.
    for (const x of enriched.filter((x) => x && x.ok && x.value)) {
        const { rk, meta, stops, oIdx } = x.value;
        // Walk every alight stop strictly after origin (we don't accept
        // back-tracking on a single route — same as a "direct" route).
        for (let i = oIdx + 1; i < stops.length; i++) {
          const alight = stops[i];
          if (alight.stop === destStop) continue; // direct, not a transfer
          // For each alight, find routes touching it AND touching dest.
          const nextRoutes = routesServingStop(alight.stop);
          for (const rk2 of nextRoutes) {
            if (rk2 === rk) continue;
            const stops2 = _routeStopsCache.get(rk2);
            if (!stops2) continue; // not fetched yet
            const d2 = stops2.findIndex((s) => s.stop === destStop);
            if (d2 < 0) continue;
            // Require forward direction on the second leg as well.
            const a2 = stops2.findIndex((s) => s.stop === alight.stop);
            if (a2 < 0 || d2 <= a2) continue;
            const m2 = idx.routes.get(rk2) || idx.ctbRoutes.get(rk2);
            const ride1Km = routeDistanceKm(stops, oIdx, i);
            const ride2Km = routeDistanceKm(stops2, a2, d2);
            // Walking from alight to the boarding stop of leg 2 = 0
            // when they're the same physical stop. Use the real walking
            // path otherwise (v47 — GraphHopper demo with haversine
            // fallback inside walkLeg()).
            const aLL = (Number.isFinite(alight.lat) && Number.isFinite(alight.lng))
              ? { lat: alight.lat, lng: alight.lng } : null;
            const board2 = stops2[a2];
            const bLL = (Number.isFinite(board2.lat) && Number.isFinite(board2.lng))
              ? { lat: board2.lat, lng: board2.lng } : null;
            const xfer = (aLL && bLL)
              ? await walkLeg(aLL.lat, aLL.lng, bLL.lat, bLL.lng)
              : { meters: 0, minutes: 0, geometry: null, routed: false };
            if (xfer.meters > TRANSFER_WALK_LIMIT_M) continue;
            candidates.push({
              legs: [
                {
                  kind: 'ride', routeKey: rk,
                  routeMeta: meta,
                  from: originStop, to: alight.stop,
                  meters: ride1Km * 1000,
                  minutes: rideMinutes(ride1Km * 1000),
                },
                {
                  kind: 'walk', from: alight.stop, to: board2.stop,
                  meters: xfer.meters, minutes: xfer.minutes,
                  geometry: xfer.geometry, routed: xfer.routed,
                  transfer: true,
                },
                {
                  kind: 'ride', routeKey: rk2,
                  routeMeta: m2,
                  from: board2.stop, to: destStop,
                  meters: ride2Km * 1000,
                  minutes: rideMinutes(ride2Km * 1000),
                },
              ],
            });
          }
        }
    }

    // Walk-out at origin and walk-in at dest.
    const originLL = stopLatLng(idx, originStop);
    const destLL = stopLatLng(idx, destStop);
    // v47 — use real walking path; same pattern as findDirect.
    const walkOut = originLL ? await walkLeg(origin.lat, origin.lng, originLL.lat, originLL.lng) : { meters: 0, minutes: 0, geometry: null, routed: false };
    const walkIn  = destLL   ? await walkLeg(dest.lat, dest.lng, destLL.lat, destLL.lng) : { meters: 0, minutes: 0, geometry: null, routed: false };
    if (walkOut.meters > ORIGIN_WALK_LIMIT_M || walkIn.meters > DEST_WALK_LIMIT_M) return [];

    const seen = new Set();
    const out = [];
    candidates.forEach((c) => {
      // The user is at origin; they need to walk *to* the boarding stop
      // of leg 1. If originStop !== board1 (which is originStop, by
      // construction) the walk is 0.
      const fullLegs = [
        { kind: 'walk', from: 'origin', to: originStop,
          meters: walkOut.meters, minutes: walkOut.minutes,
          geometry: walkOut.geometry, routed: walkOut.routed },
        ...c.legs,
        { kind: 'walk', from: destStop, to: 'dest',
          meters: walkIn.meters, minutes: walkIn.minutes,
          geometry: walkIn.geometry, routed: walkIn.routed },
      ];
      const totalMin = fullLegs.reduce((s, l) => s + l.minutes, 0);
      const sig = fullLegs.map((l) => `${l.kind}:${l.routeKey || l.from}:${l.to}`).join('|');
      if (seen.has(sig)) return;
      seen.add(sig);
      out.push({
        kind: 'one',
        totalMin,
        legs: fullLegs,
        transferStop: c.legs[0].to,
      });
    });

    return out.sort((a, b) => a.totalMin - b.totalMin).slice(0, ONE_TRANSFER_LIMIT);
  }

  // ---- 2-transfer BFS ------------------------------------------------
  // Origin → R1 → S1 (walk) → R2 → S2 (walk) → R3 → dest
  async function findTwoTransfer(idx, origin, dest) {
    const originStop = origin.stop;
    const destStop = dest.stop;
    // First-hop candidates via the reverse index, falling back to the
    // per-stop shortcut (KMB /stop-eta, CTB /batch/stop-eta) on cold start.
    let routesFromOrigin = routesServingStop(originStop);
    if (routesFromOrigin.length === 0) {
      const shortcut = await fetchRoutesServingStop(originStop);
      routesFromOrigin = shortcut.map((m) => `${m.co}|${m.route}|${m.dir}|${m.service}`);
      await mapWithCap(shortcut, CONCURRENCY, async (m) => {
        const k = `${m.co}|${m.route}|${m.dir}|${m.service}`;
        await getRouteStops(idx, k, m);
      });
      if (routesFromOrigin.length === 0) return [];
    }

    // For each R1 from origin, for each alight S1, for each R2 from S1,
    // for each alight S2, for each R3 from S2 that reaches dest, score.
    const enriched = await mapWithCap(routesFromOrigin, CONCURRENCY, async (rk) => {
      const stops = await getRouteStops(idx, rk);
      if (!stops) return null;
      const oIdx = stops.findIndex((s) => s.stop === originStop);
      if (oIdx < 0) return null;
      return { rk, meta: idx.routes.get(rk) || idx.ctbRoutes.get(rk), stops, oIdx };
    });

    const candidates = [];
    for (const x of enriched) {
      if (!x || !x.ok || !x.value) continue;
      const { rk: rk1, meta: meta1, stops: stops1, oIdx } = x.value;
      for (let i = oIdx + 1; i < Math.min(oIdx + 50, stops1.length); i++) {
        const alight1 = stops1[i];
        const r2s = routesServingStop(alight1.stop);
        for (const rk2 of r2s) {
          if (rk2 === rk1) continue;
          const stops2 = _routeStopsCache.get(rk2);
          if (!stops2) continue;
          const a2 = stops2.findIndex((s) => s.stop === alight1.stop);
          if (a2 < 0) continue;
          for (let j = a2 + 1; j < Math.min(a2 + 50, stops2.length); j++) {
            const alight2 = stops2[j];
            const r3s = routesServingStop(alight2.stop);
            for (const rk3 of r3s) {
              if (rk3 === rk1 || rk3 === rk2) continue;
              const stops3 = _routeStopsCache.get(rk3);
              if (!stops3) continue;
              const a3 = stops3.findIndex((s) => s.stop === alight2.stop);
              if (a3 < 0) continue;
              const d3 = stops3.findIndex((s) => s.stop === destStop);
              if (d3 <= a3) continue;
              const meta2 = idx.routes.get(rk2) || idx.ctbRoutes.get(rk2);
              const meta3 = idx.routes.get(rk3) || idx.ctbRoutes.get(rk3);

              // v47 — real walking path for transfer walks via walkLeg(); xfersM/haver
              // becomes the haversine fallback when the public GraphHopper
              // demo is unreachable.
              const xfer1 = (alight1.lat != null && stops2[a2].lat != null)
                ? await walkLeg(alight1.lat, alight1.lng, stops2[a2].lat, stops2[a2].lng)
                : { meters: 0, minutes: 0, geometry: null, routed: false };
              const xfer2 = (alight2.lat != null && stops3[a3].lat != null)
                ? await walkLeg(alight2.lat, alight2.lng, stops3[a3].lat, stops3[a3].lng)
                : { meters: 0, minutes: 0, geometry: null, routed: false };
              if (xfer1.meters > TRANSFER_WALK_LIMIT_M || xfer2.meters > TRANSFER_WALK_LIMIT_M) continue;
              const ride1Km = routeDistanceKm(stops1, oIdx, i);
              const ride2Km = routeDistanceKm(stops2, a2, j);
              const ride3Km = routeDistanceKm(stops3, a3, d3);

              candidates.push({
                legs: [
                    { kind: 'ride', routeKey: rk1, routeMeta: meta1,
                      from: originStop, to: alight1.stop,
                      meters: ride1Km * 1000, minutes: rideMinutes(ride1Km * 1000) },
                    { kind: 'walk', from: alight1.stop, to: stops2[a2].stop,
                      meters: xfer1.meters, minutes: xfer1.minutes,
                      geometry: xfer1.geometry, routed: xfer1.routed,
                      transfer: true },
                    { kind: 'ride', routeKey: rk2, routeMeta: meta2,
                      from: stops2[a2].stop, to: alight2.stop,
                      meters: ride2Km * 1000, minutes: rideMinutes(ride2Km * 1000) },
                    { kind: 'walk', from: alight2.stop, to: stops3[a3].stop,
                      meters: xfer2.meters, minutes: xfer2.minutes,
                      geometry: xfer2.geometry, routed: xfer2.routed,
                      transfer: true },
                    { kind: 'ride', routeKey: rk3, routeMeta: meta3,
                      from: stops3[a3].stop, to: destStop,
                      meters: ride3Km * 1000, minutes: rideMinutes(ride3Km * 1000) },
                  ],
                });
            }
          }
        }
      }
    }

    const originLL = stopLatLng(idx, originStop);
    const destLL = stopLatLng(idx, destStop);
    // v47 — real walking path (walkLeg) for the outer walk-out/walk-in;
    // transfer walks inside c.legs already routed via walkLeg above.
    const walkOut = originLL ? await walkLeg(origin.lat, origin.lng, originLL.lat, originLL.lng) : { meters: 0, minutes: 0, geometry: null, routed: false };
    const walkIn  = destLL   ? await walkLeg(dest.lat, dest.lng, destLL.lat, destLL.lng) : { meters: 0, minutes: 0, geometry: null, routed: false };
    if (walkOut.meters > ORIGIN_WALK_LIMIT_M || walkIn.meters > DEST_WALK_LIMIT_M) return [];

    const seen = new Set();
    const out = [];
    candidates.forEach((c) => {
      const fullLegs = [
        { kind: 'walk', from: 'origin', to: originStop,
          meters: walkOut.meters, minutes: walkOut.minutes,
          geometry: walkOut.geometry, routed: walkOut.routed },
        ...c.legs,
        { kind: 'walk', from: destStop, to: 'dest',
          meters: walkIn.meters, minutes: walkIn.minutes,
          geometry: walkIn.geometry, routed: walkIn.routed },
      ];
      const totalMin = fullLegs.reduce((s, l) => s + l.minutes, 0);
      const sig = fullLegs.map((l) => `${l.kind}:${l.routeKey || l.from}:${l.to}`).join('|');
      if (seen.has(sig)) return;
      seen.add(sig);
      out.push({ kind: 'two', totalMin, legs: fullLegs });
    });

    return out.sort((a, b) => a.totalMin - b.totalMin).slice(0, TWO_TRANSFER_LIMIT);
  }

  function xferMeters(s1, s2) {
    if (!Number.isFinite(s1.lat) || !Number.isFinite(s2.lat)) return 0;
    return haversine(s1.lat, s1.lng, s2.lat, s2.lng) * 1000;
  }

  // ---- MTR + LRT (Light Rail) routing --------------------------------
  // Both MTR heavy rail and LRT have their full topology offline
  // (assets/mtr-lines.json and assets/lrt-routes.json), so routing
  // between two rail stations is a pure-graph problem: no upstream API
  // calls, results in <10 ms. This unblocks "金鐘 → 中環"-style queries
  // that the bus planner cannot answer.
  const MTR_PER_STATION_MIN = 2.2;        // avg time between consecutive MTR stations
  const LRT_PER_STATION_MIN = 1.8;        // LRT slightly faster (shorter inter-stop)
  const RAIL_TRANSFER_MIN   = 5;          // paid-area transfer (walk + wait + board)
  const LRT_TRANSFER_MIN    = 4;          // LRT paid-area transfer
  const MTR_LINES_URL       = 'assets/mtr-lines.json?v=15';
  const LRT_LINES_URL       = 'assets/lrt-routes.json?v=15';
  const MTR_FARES_URL       = 'assets/mtr-fares.json?v=1';
  const LRT_FARES_URL       = 'assets/lrt-fares.json?v=1';

  let _mtrGraphCache   = null;
  let _lrtGraphCache   = null;
  let _mtrGraphPromise = null;
  let _lrtGraphPromise = null;
  let _mtrFaresCache   = null;
  let _mtrFaresPromise = null;
  let _lrtFaresCache   = null;
  let _lrtFaresPromise = null;

  function invalidateRailGraphs() {
    _mtrGraphCache = null;
    _lrtGraphCache = null;
    _mtrGraphPromise = null;
    _lrtGraphPromise = null;
    _mtrFaresCache = null;
    _lrtFaresCache = null;
    _mtrFaresPromise = null;
    _lrtFaresPromise = null;
  }

  // ---- MTR / LRT fare tables (lazy-load on first planner query) ----
  // Returns the parsed JSON object from assets/mtr-fares.json, which
  // holds curated station-to-station Octopus fares (curated subset of
  // HK rail stations, see file's _meta.source). On any fetch error the
  // cache stores `null` so subsequent calls return immediately.
  async function ensureMtrFares() {
    if (_mtrFaresCache !== null) return _mtrFaresCache;
    if (_mtrFaresPromise) return _mtrFaresPromise;
    _mtrFaresPromise = (async () => {
      try {
        const resp = await fetch(MTR_FARES_URL);
        if (!resp.ok) return null;
        return await resp.json();
      } catch (e) { return null; }
    })();
    try {
      _mtrFaresCache = await _mtrFaresPromise;
    } finally {
      _mtrFaresPromise = null;
    }
    return _mtrFaresCache;
  }
  async function ensureLrtFares() {
    if (_lrtFaresCache !== null) return _lrtFaresCache;
    if (_lrtFaresPromise) return _lrtFaresPromise;
    _lrtFaresPromise = (async () => {
      try {
        const resp = await fetch(LRT_FARES_URL);
        if (!resp.ok) return null;
        return await resp.json();
      } catch (e) { return null; }
    })();
    try {
      _lrtFaresCache = await _lrtFaresPromise;
    } finally {
      _lrtFaresPromise = null;
    }
    return _lrtFaresCache;
  }
  // Look up MTR fare between two 3-letter station codes. Returns a number
  // (HKD Octopus) or null when no fare is available. Looks up both
  // (A→B) and (B→A) since fares are symmetric.
  function lookupMtrFare(fares, from, to) {
    if (!fares || !from || !to || from === to) return null;
    const f1 = fares[from];
    if (f1 && f1[to] && Number.isFinite(Number(f1[to].octopus))) return Number(f1[to].octopus);
    const f2 = fares[to];
    if (f2 && f2[from] && Number.isFinite(Number(f2[from].octopus))) return Number(f2[from].octopus);
    return null;
  }
  // LRT fares are flat per-route, so the lookup is route-only.
  function lookupLrtFare(fares, route) {
    if (!fares || !route) return null;
    const entry = fares[String(route)];
    if (!entry) return null;
    const v = Number(entry.octopus != null ? entry.octopus : entry.fare);
    return Number.isFinite(v) ? v : null;
  }

  async function ensureMtrGraph(idx) {
    if (_mtrGraphCache) return _mtrGraphCache;
    if (_mtrGraphPromise) return _mtrGraphPromise;
    _mtrGraphPromise = (async () => {
      let rows = null;
      try {
        const resp = await fetch(MTR_LINES_URL);
        if (resp.ok) rows = await resp.json();
      } catch (e) { rows = null; }
      return buildMtrGraph(idx, rows);
    })();
    try {
      _mtrGraphCache = await _mtrGraphPromise;
    } finally {
      _mtrGraphPromise = null;
    }
    return _mtrGraphCache;
  }

  async function ensureLrtGraph(idx) {
    if (_lrtGraphCache) return _lrtGraphCache;
    if (_lrtGraphPromise) return _lrtGraphPromise;
    _lrtGraphPromise = (async () => {
      let rows = null;
      try {
        const resp = await fetch(LRT_LINES_URL);
        if (resp.ok) rows = await resp.json();
      } catch (e) { rows = null; }
      return buildLrtGraph(idx, rows);
    })();
    try {
      _lrtGraphCache = await _lrtGraphPromise;
    } finally {
      _lrtGraphPromise = null;
    }
    return _lrtGraphCache;
  }

  // Build the MTR network: line → ordered stations, station → lines.
  function buildMtrGraph(idx, rows) {
    const lines = new Map();
    if (Array.isArray(rows)) {
      for (const r of rows) {
        const lc = r.line;
        if (!lc || !r.station) continue;
        if (!lines.has(lc)) lines.set(lc, []);
        lines.get(lc).push({
          stop: r.station,
          // Anchor on the "down-train" (DT) direction. The same station
          // appears in DT and UT with reversed seq numbers; we need a
          // single linear order per line, so we always pick DT. Mixing
          // DT and UT seqs produces an incorrect order where, e.g.,
          // ADM(seq=12) and CEN(seq=5) swap places.
          dir: r.dir,
          seq: Number(r.seq) || 0,
          zh: r.zh || '',
          en: r.en || '',
        });
      }
      // Keep only the DT entries so each station appears once per line.
      for (const [lc, list] of lines) {
        const map = new Map();
        for (const it of list) {
          if (it.dir !== 'DT') continue;
          map.set(it.stop, it);
        }
        const ordered = Array.from(map.values()).sort((a, b) => a.seq - b.seq);
        lines.set(lc, ordered);
      }
    }
    const stations = new Map();
    if (idx && idx.mtr) {
      idx.mtr.forEach((s, code) => {
        if (s._isLine) return;
        stations.set(code, {
          stop: code,
          nameTc: s.nameTc || '',
          nameEn: s.nameEn || '',
          lat: Number.isFinite(s.lat) ? s.lat : null,
          lng: Number.isFinite(s.lng) ? s.lng : null,
          lines: Array.isArray(s.lines) ? s.lines.slice() : [],
        });
      });
    }
    return { lines, stations };
  }

  // Build the LRT (Light Rail) network: route → ordered stops, stop → routes.
  function buildLrtGraph(idx, rows) {
    const routes = new Map();
    if (Array.isArray(rows)) {
      for (const r of rows) {
        const no = String(r.route);
        if (!no || !r.stop) continue;
        if (!routes.has(no)) routes.set(no, []);
        routes.get(no).push({
          stop: r.stop,
          dir: String(r.dir || '1'),
          seq: Number(r.seq) || 0,
          zh: r.zh || '',
          en: r.en || '',
        });
      }
      // LRT routes have two directions ('1' and '2') with reversed orders;
      // pick '1' as the canonical linear order to avoid adjacency breakage.
      for (const [no, list] of routes) {
        const map = new Map();
        for (const it of list) {
          if (it.dir !== '1') continue;
          map.set(it.stop, it);
        }
        const ordered = Array.from(map.values()).sort((a, b) => a.seq - b.seq);
        routes.set(no, ordered);
      }
    }
    const stops = new Map();
    if (idx && idx.lrt && idx.lrt.stops) {
      idx.lrt.stops.forEach((s, code) => {
        stops.set(code, {
          stop: code,
          nameTc: s.nameTc || '',
          nameEn: s.nameEn || '',
          // v45 — lat/lng pulled from state.index.lrt.stops, which is
          // populated by buildIndex() merging assets/lrt-stops.json
          // (a curated lat/lng table; lrt-routes.json has only route +
          // stop names with no coordinates). railRoute()'s haversine
          // helper uses these to compute km on LRT ride legs.
          lat: Number.isFinite(s.lat) ? s.lat : null,
          lng: Number.isFinite(s.lng) ? s.lng : null,
          routes: Array.isArray(s._routes) ? s._routes.slice() : [],
        });
      });
    }
    return { routes, stops };
  }

  // Generic rail router (Dijkstra). State = (segmentId, stopId).
  // Returns { direct: [journey], oneTransfer: [journey] } so the result
  // slots into the same `direct`/`oneTransfer` buckets the bus planner uses.
  async function railRoute(graph, origin, dest, idx, opts) {
    const { co, perStationMin, transferMin, routeMetaFor } = opts;
    const segments = co === 'MTR' ? graph.lines : graph.routes;
    const reverseIdx = co === 'MTR' ? graph.stations : graph.stops;
    const linesField = co === 'MTR' ? 'lines' : 'routes';

    const segsAt = (stop) => {
      const m = reverseIdx.get(stop);
      return m ? (m[linesField] || []) : [];
    };

    const initialSegs = segsAt(origin.stop);
    if (initialSegs.length === 0 || segsAt(dest.stop).length === 0) {
      return { direct: [], oneTransfer: [] };
    }

    const keyOf = (seg, stop) => seg + '\x00' + stop;
    const dist = new Map();
    const prev = new Map();        // state key -> { fromKey, seg, fromStop, toStop, kind }
    const visited = new Set();

    const queue = [];
    for (const seg of initialSegs) {
      const k = keyOf(seg, origin.stop);
      if (!dist.has(k)) {
        dist.set(k, 0);
        prev.set(k, null);
        queue.push({ seg, stop: origin.stop, cost: 0 });
      }
    }

    let bestArrivalKey = null;
    let bestArrivalCost = Infinity;

    // Lazy pop: find min each iteration. For a 97-station network this is
    // trivial; if we ever grow this we can swap in a binary heap.
    while (queue.length > 0) {
      let minIdx = 0;
      for (let i = 1; i < queue.length; i++) {
        if (queue[i].cost < queue[minIdx].cost) minIdx = i;
      }
      const cur = queue.splice(minIdx, 1)[0];
      const k = keyOf(cur.seg, cur.stop);
      if (visited.has(k)) continue;
      visited.add(k);

      if (cur.stop === dest.stop && cur.cost < bestArrivalCost) {
        bestArrivalCost = cur.cost;
        bestArrivalKey = k;
        // Don't break: a later state may arrive at dest on a different
        // line and could be cheaper (transfers vs direct ride).
        continue;
      }

      // Ride one station in either direction on the current segment.
      const segStops = segments.get(cur.seg) || [];
      const idxOnSeg = segStops.findIndex((s) => s.stop === cur.stop);
      if (idxOnSeg >= 0) {
        for (const step of [-1, 1]) {
          const next = segStops[idxOnSeg + step];
          if (!next) continue;
          const nextK = keyOf(cur.seg, next.stop);
          if (visited.has(nextK)) continue;
          const newCost = cur.cost + perStationMin;
          if (!dist.has(nextK) || newCost < dist.get(nextK)) {
            dist.set(nextK, newCost);
            prev.set(nextK, { fromKey: k, seg: cur.seg, fromStop: cur.stop, toStop: next.stop, kind: 'ride' });
            queue.push({ seg: cur.seg, stop: next.stop, cost: newCost });
          }
        }
      }

      // Transfer at this stop to any other segment that touches it.
      for (const nextSeg of segsAt(cur.stop)) {
        if (nextSeg === cur.seg) continue;
        const nextK = keyOf(nextSeg, cur.stop);
        if (visited.has(nextK)) continue;
        const newCost = cur.cost + transferMin;
        if (!dist.has(nextK) || newCost < dist.get(nextK)) {
          dist.set(nextK, newCost);
          prev.set(nextK, { fromKey: k, seg: nextSeg, fromStop: cur.stop, toStop: cur.stop, kind: 'walk' });
          queue.push({ seg: nextSeg, stop: cur.stop, cost: newCost });
        }
      }
    }

    if (!bestArrivalKey) return { direct: [], oneTransfer: [] };

    // Reconstruct the path by walking `prev` backwards from `bestArrivalKey`.
    const steps = [];
    let cur = prev.get(bestArrivalKey);
    while (cur) {
      steps.push(cur);
      cur = prev.get(cur.fromKey);
    }
    steps.reverse();

    // Convert steps into legs matching the bus-planner shape, merging
    // consecutive rides on the same segment into a single leg.
    const legs = [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.kind === 'ride') {
        // v45 — compute real km via haversine between consecutive stations
        // so the planner card's "乘車" meter is no longer 0m. Both MTR
        // (mtr-stops.json) and LRT (assets/lrt-stops.json curated table)
        // now feed lat/lng into buildMtrGraph / buildLrtGraph, so this
        // branch covers every ride regardless of operator.
        let rideMeters = 0;
        const fromMeta = reverseIdx.get(s.fromStop);
        const toMeta = reverseIdx.get(s.toStop);
        if (fromMeta && toMeta &&
            Number.isFinite(fromMeta.lat) && Number.isFinite(fromMeta.lng) &&
            Number.isFinite(toMeta.lat) && Number.isFinite(toMeta.lng)) {
          rideMeters = haversine(fromMeta.lat, fromMeta.lng, toMeta.lat, toMeta.lng) * 1000;
        }
        legs.push({
          kind: 'ride',
          routeKey: co + '|' + s.seg,
          routeMeta: routeMetaFor(s.seg),
          from: s.fromStop,
          to: s.toStop,
          meters: rideMeters,
          minutes: perStationMin,
        });
      } else {
        // Transfer leg — annotate with the line/route we're leaving and
        // boarding so the UI can render "港島綫 → 荃灣綫" instead of a
        // cryptic same-station ↔.
        const prevStep = steps[i - 1];
        const nextStep = steps[i + 1];
        const fromName = (prevStep && prevStep.kind === 'ride')
          ? pickLineName(routeMetaFor(prevStep.seg)) : '';
        const toName = (nextStep && nextStep.kind === 'ride')
          ? pickLineName(routeMetaFor(nextStep.seg)) : '';
        legs.push({
          kind: 'walk',
          transfer: true,
          from: s.fromStop,
          to: s.toStop,
          meters: 0,
          minutes: transferMin,
          _fromLineName: fromName,
          _toLineName: toName,
        });
      }
    }
    const merged = [];
    for (const l of legs) {
      const tail = merged[merged.length - 1];
      if (tail && l.kind === 'ride' && tail.kind === 'ride' && tail.routeKey === l.routeKey) {
        tail.to = l.to;
        tail.minutes = +(tail.minutes + l.minutes).toFixed(2);
        // v42 — sum meters across consecutive single-station ride legs so a
        // multi-station ride on the same line shows the full km, not just
        // the first hop's km.
        tail.meters = (Number.isFinite(tail.meters) ? tail.meters : 0)
                    + (Number.isFinite(l.meters) ? l.meters : 0);
      } else {
        merged.push({ ...l });
      }
    }

    // Walk-out at origin and walk-in at dest, gated by the same walk
    // budgets as the bus planner so we don't suggest walks that exceed
    // the limit (e.g. user typed the station name but is actually far
    // away — we still offer the MTR route but cap the walk cost).
    const originLL = stopLatLng(idx, origin.stop);
    const destLL   = stopLatLng(idx, dest.stop);
    // v47 — real walking path for the rail planner's outer walk legs.
    const walkOut = (originLL && Number.isFinite(origin.lat) && Number.isFinite(origin.lng))
      ? await walkLeg(origin.lat, origin.lng, originLL.lat, originLL.lng)
      : { meters: 0, minutes: 0, geometry: null, routed: false };
    const walkIn  = (destLL && Number.isFinite(dest.lat) && Number.isFinite(dest.lng))
      ? await walkLeg(dest.lat, dest.lng, destLL.lat, destLL.lng)
      : { meters: 0, minutes: 0, geometry: null, routed: false };
    const includeWalkOut = walkOut.meters > 0 && walkOut.meters <= ORIGIN_WALK_LIMIT_M;
    const includeWalkIn  = walkIn.meters > 0  && walkIn.meters  <= DEST_WALK_LIMIT_M;

    const fullLegs = [];
    if (includeWalkOut) {
      fullLegs.push({ kind: 'walk', from: 'origin', to: origin.stop,
        meters: walkOut.meters, minutes: walkOut.minutes,
        geometry: walkOut.geometry, routed: walkOut.routed });
    }
    for (const l of merged) fullLegs.push(l);
    if (includeWalkIn) {
      fullLegs.push({ kind: 'walk', from: dest.stop, to: 'dest',
        meters: walkIn.meters, minutes: walkIn.minutes,
        geometry: walkIn.geometry, routed: walkIn.routed });
    }

    const totalMin = fullLegs.reduce((s, l) => s + l.minutes, 0);
    const transfers = merged.filter((l) => l.kind === 'walk' && l.transfer).length;
    const journey = {
      legs: fullLegs,
      totalMin,
      kind: transfers === 0 ? 'direct' : (transfers === 1 ? 'one' : 'two'),
    };

    const out = { direct: [], oneTransfer: [] };
    if (journey.kind === 'direct') out.direct.push(journey);
    else if (journey.kind === 'one') out.oneTransfer.push(journey);
    // Two-transfer rail routes are vanishingly rare; ignore.
    return out;
  }

  async function findMtrRoutes(idx, origin, dest) {
    if (!idx || !idx.mtr) return { direct: [], oneTransfer: [] };
    // v48 — cross-mode handling for the *origin* side. The previous
    // early-return `if (!idx.mtr.has(origin.stop)) return …` made the
    // cross-mode block below unreachable for any user who started from
    // a KMB / CTB / NWFB / GMB stop (e.g. MA309 馬鞍山市中心 → KT924
    // 觀塘(裕民坊)總站 — both pure bus stops). The bus sub-planners
    // had no KMB↔KMB route and findMtrRoutes returned empty, so the
    // UI surfaced "暫時搵唔到合適嘅路線" despite a perfectly valid
    // bus → walk → MTR → walk → bus journey. We now fall through and
    // let the cross-mode block resolve the origin to its nearest MTR
    // station. The dest-side cross-mode block was already reachable
    // because the v48 entry-point didn't early-return on dest.
    const graph = await ensureMtrGraph(idx);
    if (!graph || !graph.lines || graph.lines.size === 0) {
      return { direct: [], oneTransfer: [] };
    }
    const routeMetaFor = (lineCode) => {
      const m = idx.mtr.get('MTR|' + lineCode);
      if (m) return { co: 'MTR', route: lineCode, origTc: m.origTc, origEn: m.origEn, destTc: m.destTc, destEn: m.destEn };
      return { co: 'MTR', route: lineCode };
    };
    const opts = { co: 'MTR', perStationMin: MTR_PER_STATION_MIN, transferMin: RAIL_TRANSFER_MIN, routeMetaFor };

    // v48 — cross-mode handling. If dest.stop is not an MTR station (e.g.
    // it's a KMB bus stop like MA180 馬鞍山警署), route the MTR Dijkstra to
    // the *nearest* MTR station to dest's lat/lng and stitch a real
    // walking leg from that station to dest via walkLeg() (v47 GraphHopper
    // demo or haversine fallback). Same symmetric path for origin when
    // the user starts from a KMB / CTB / NWFB / GMB stop.
    //
    // We zero out the user-typed coords on the railDestination so railRoute's
    // internal walkIn is 0 — the appended cross-mode walk is the only
    // user-facing walk-in. Otherwise we'd get TWO: railRoute's walk from
    // the bus stop to the rail station (wrong direction), plus our
    // appended walk from the rail station to the bus stop.
    let railDest = dest;
    let railOrigin = origin;
    let crossWalkStart = null;  // { stop, lat, lng } — start of stitched walk
    let crossWalkEnd   = null;
    if (!idx.mtr.has(dest.stop) && Number.isFinite(dest.lat) && Number.isFinite(dest.lng)) {
      const n = findNearestMtrStop(idx, dest.lat, dest.lng);
      if (!n || n.length === 0) return { direct: [], oneTransfer: [] };
      // Zero out coords so railRoute's internal walkIn resolves to 0.
      railDest = { stop: n[0].code, lat: n[0].lat, lng: n[0].lng };
      crossWalkEnd = { stop: n[0].code, lat: n[0].lat, lng: n[0].lng };
    }
    if (!idx.mtr.has(origin.stop) && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
      const n = findNearestMtrStop(idx, origin.lat, origin.lng);
      if (!n || n.length === 0) return { direct: [], oneTransfer: [] };
      // Zero out coords so railRoute's internal walkOut resolves to 0.
      railOrigin = { stop: n[0].code, lat: n[0].lat, lng: n[0].lng };
      crossWalkStart = { stop: n[0].code, lat: n[0].lat, lng: n[0].lng };
    }
    if (!idx.mtr.has(railOrigin.stop) || !idx.mtr.has(railDest.stop)) {
      return { direct: [], oneTransfer: [] };
    }

    const result = await railRoute(graph, railOrigin, railDest, idx, opts);

    // v48 — bridge cross-mode transitions with a real walking leg.
    if (crossWalkStart && result.direct.length + result.oneTransfer.length > 0) {
      // walkOut leg: from user's actual origin → nearest MTR station.
      await appendCrossModeWalk(
        [].concat(result.direct, result.oneTransfer),
        { stop: 'origin', lat: origin.lat, lng: origin.lng },
        crossWalkStart,
        origin.stop,
      );
    }
    if (crossWalkEnd && result.direct.length + result.oneTransfer.length > 0) {
      // walkIn leg: from nearest MTR station → user's actual destination.
      await appendCrossModeWalk(
        [].concat(result.direct, result.oneTransfer),
        crossWalkEnd,
        { stop: 'dest', lat: dest.lat, lng: dest.lng },
        dest.stop,
      );
    }

    // Attach MTR fares to ride legs (curated station-to-station lookup in
    // assets/mtr-fares.json). For multi-leg rides the fare is the per-leg
    // O/D fare — accurate enough to give the user a sensible budget number.
    const fares = await ensureMtrFares();
    [result.direct, result.oneTransfer].forEach((arr) => {
      arr.forEach((j) => {
        if (!j || !j.legs) return;
        j.legs.forEach((l) => {
          if (l && l.kind === 'ride' && l.from && l.to) {
            const f = lookupMtrFare(fares, l.from, l.to);
            if (f != null) l.fare = f;
          }
        });
      });
    });
    return result;
  }

  async function findLrtRoutes(idx, origin, dest) {
    if (!idx || !idx.lrt || !idx.lrt.stops) return { direct: [], oneTransfer: [] };
    // v48 — mirror the findMtrRoutes fix: drop the early-return on
    // non-LRT origin so the cross-mode block (origin → nearest LRT
    // platform) actually runs. Same UI symptom (spurious "no results")
    // for any origin that's a KMB / MTR stop rather than an LRT stop.
    const graph = await ensureLrtGraph(idx);
    if (!graph || !graph.routes || graph.routes.size === 0) {
      return { direct: [], oneTransfer: [] };
    }
    const routeMetaFor = (routeNo) => {
      const m = idx.lrt.routes.get('LRT|' + routeNo);
      if (m) return { co: 'LRT', route: routeNo, origTc: m.origTc, origEn: m.origEn, destTc: m.destTc, destEn: m.destEn };
      return { co: 'LRT', route: routeNo };
    };
    const opts = { co: 'LRT', perStationMin: LRT_PER_STATION_MIN, transferMin: LRT_TRANSFER_MIN, routeMetaFor };

    // v48 — cross-mode handling (mirror of findMtrRoutes above). When the
    // user picks a KMB / CTB / MTR stop as one side, route the LRT side
    // to the nearest LRT platform and stitch a walkLeg from the LRT
    // stop to the actual destination.
    //
    // railDest / railOrigin use the LRT stop's own coords (not the user's)
    // so railRoute's internal walkIn / walkOut resolve to 0 — the appended
    // cross-mode walks are the only user-facing walk legs. Otherwise we'd
    // get duplicate walks in opposite directions.
    let railDest = dest;
    let railOrigin = origin;
    let crossWalkStart = null;
    let crossWalkEnd   = null;
    if (!idx.lrt.stops.has(dest.stop) && Number.isFinite(dest.lat) && Number.isFinite(dest.lng)) {
      const n = findNearestLrtStop(idx, dest.lat, dest.lng);
      if (!n || n.length === 0) return { direct: [], oneTransfer: [] };
      railDest = { stop: n[0].code, lat: n[0].lat, lng: n[0].lng };
      crossWalkEnd = { stop: n[0].code, lat: n[0].lat, lng: n[0].lng };
    }
    if (!idx.lrt.stops.has(origin.stop) && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
      const n = findNearestLrtStop(idx, origin.lat, origin.lng);
      if (!n || n.length === 0) return { direct: [], oneTransfer: [] };
      railOrigin = { stop: n[0].code, lat: n[0].lat, lng: n[0].lng };
      crossWalkStart = { stop: n[0].code, lat: n[0].lat, lng: n[0].lng };
    }
    if (!idx.lrt.stops.has(railOrigin.stop) || !idx.lrt.stops.has(railDest.stop)) {
      return { direct: [], oneTransfer: [] };
    }

    const result = await railRoute(graph, railOrigin, railDest, idx, opts);

    if (crossWalkStart && result.direct.length + result.oneTransfer.length > 0) {
      // walkOut leg: from user's actual origin → nearest LRT platform.
      await appendCrossModeWalk(
        [].concat(result.direct, result.oneTransfer),
        { stop: 'origin', lat: origin.lat, lng: origin.lng },
        crossWalkStart,
        origin.stop,
      );
    }
    if (crossWalkEnd && result.direct.length + result.oneTransfer.length > 0) {
      // walkIn leg: from nearest LRT platform → user's actual destination.
      await appendCrossModeWalk(
        [].concat(result.direct, result.oneTransfer),
        crossWalkEnd,
        { stop: 'dest', lat: dest.lat, lng: dest.lng },
        dest.stop,
      );
    }

    // LRT fares are flat per-route (assets/lrt-fares.json). Same fare on
    // every ride leg of a journey since they're all on the same line.
    const fares = await ensureLrtFares();
    [result.direct, result.oneTransfer].forEach((arr) => {
      arr.forEach((j) => {
        if (!j || !j.legs) return;
        j.legs.forEach((l) => {
          if (l && l.kind === 'ride' && l.routeMeta && l.routeMeta.route) {
            const f = lookupLrtFare(fares, l.routeMeta.route);
            if (f != null) l.fare = f;
          }
        });
      });
    });
    return result;
  }

  // ---- v52 — Mixed bus+rail builder ----------------------------------
  // For each rail journey (MTR or LRT), try to prepend a direct bus
  // leg from the user's origin to the rail entry station and/or
  // append a direct bus leg from the rail exit station to the user's
  // destination. When either exists, the resulting journey has both
  // bus and rail legs — strategyOf() classifies it as "mixed" and
  // the user sees it in a separate section alongside the pure bus
  // and pure rail alternatives.
  //
  // Each mixed candidate requires 0-2 extra findDirect() calls
  // (each fetchRoutesServingStop pre-warm costs ~250ms API RTT).
  // Capped at MAX_MIXED_PER_RAIL to bound the worst-case work.
  const MAX_MIXED_PER_RAIL = 1;       // only the shortest pre/post bus per rail
  async function buildMixedJourneys(idx, origin, dest, railJourneys, railCo) {
    const out = [];
    // Each rail journey's entry/exit station is looked up once; we
    // dedupe findDirect() calls across all rail journeys so multiple
    // rails through the same entry don't trigger duplicate pre-warms.
    const preBusCache = new Map();   // entryStation → shortest bus journey
    const postBusCache = new Map();  // exitStation  → shortest bus journey
    const entryMetaOf = (s) => {
      if (railCo === 'MTR') {
        const m = idx.mtr && idx.mtr.get(s);
        return (m && Number.isFinite(m.lat) && Number.isFinite(m.lng)) ? m : null;
      }
      const m = idx.lrt && idx.lrt.stops && idx.lrt.stops.get(s);
      return (m && Number.isFinite(m.lat) && Number.isFinite(m.lng)) ? m : null;
    };
    async function getPreBus(entry) {
      if (origin.stop === entry) return Promise.resolve(null);
      if (preBusCache.has(entry)) return preBusCache.get(entry);
      const m = entryMetaOf(entry);
      if (!m) { preBusCache.set(entry, null); return null; }
      // v52.2 — MTR/LRT station codes never appear in a bus route's stop
      // list (KMB uses 16-hex, CTB uses 6-digit, GMB uses numeric IDs).
      // Resolve the closest bus stop within ~500m so findDirect() can
      // actually find a route; the extra walk from that bus stop to the
      // rail entry is added as a tail leg in the splice below.
      const near = findNearestBusStop(idx, m.lat, m.lng, 500);
      if (!near) { preBusCache.set(entry, null); return null; }
      const stopObj = { stop: near.stop, lat: near.lat, lng: near.lng };
      const direct = await findDirect(idx, origin, stopObj);
      const best = direct.length > 0 ? direct[0] : null;
      preBusCache.set(entry, best);
      return best;
    }
    async function getPostBus(exit) {
      if (exit === dest.stop) return Promise.resolve(null);
      if (postBusCache.has(exit)) return postBusCache.get(exit);
      const m = entryMetaOf(exit);
      if (!m) { postBusCache.set(exit, null); return null; }
      // v52.2 — same fix as getPreBus. Resolve the nearest bus stop to
      // the rail exit so findDirect() can return a real route.
      const near = findNearestBusStop(idx, m.lat, m.lng, 500);
      if (!near) { postBusCache.set(exit, null); return null; }
      const stopObj = { stop: near.stop, lat: near.lat, lng: near.lng };
      const direct = await findDirect(idx, stopObj, dest);
      const best = direct.length > 0 ? direct[0] : null;
      postBusCache.set(exit, best);
      return best;
    }
    for (const rj of railJourneys) {
      if (!rj.legs || rj.legs.length === 0) continue;
      // Find rail entry/exit stations (first / last ride leg's from/to).
      let entry = null, exit = null;
      for (const l of rj.legs) {
        if (l && l.kind === 'ride') {
          if (!entry) entry = l.from;
          exit = l.to;
        }
      }
      if (!entry || !exit) continue;
      const [preBus, postBus] = await Promise.all([getPreBus(entry), getPostBus(exit)]);
      if (!preBus && !postBus) continue;
      // v52.1 — locate walkOut / walkIn by label, not by index, so the
      // cross-mode append pattern works (findMtrRoutes pushes the cross
      // walks at the END of rj.legs, so legs[0] is the ride, not the
      // walkOut). The walkIn leg uses `to=dest.stop` in cross-mode but
      // `to='dest'` in pureRail — match either.
      const legs = rj.legs;
      const walkOut = legs.find((l) => l && l.kind === 'walk' && l.from === 'origin');
      const walkIn = legs.find((l) => l && l.kind === 'walk' && (l.to === 'dest' || l.to === dest.stop));
      const rideLegs = legs.filter((l) => l && l.kind === 'ride');
      // Transfer walks (railRoute's between-line hops) keep their position
      // relative to the rides; we just rebuild the journey in logical
      // order [preBus | walkOut, ride(s), walkIn | postBus].
      const transferWalks = legs.filter((l) => l && l.kind === 'walk' && l.transfer);
      const newLegs = [];
      if (preBus) {
        for (const bl of preBus.legs) newLegs.push(bl);
        // v52.2 — findDirect's dest is the nearest *bus* stop near `entry`,
        // not the rail entry itself. Add a walk from that bus stop to the
        // MTR/LRT entry so the rail ride can start there. Find the bus
        // alighting stop from the last ride leg in preBus (its `to`).
        const lastBusRide = [...preBus.legs].reverse().find((l) => l && l.kind === 'ride');
        const alightStop = lastBusRide ? lastBusRide.to : null;
        if (alightStop && alightStop !== entry) {
          const aMeta = stopLatLng(idx, alightStop);
          const eMeta = entryMetaOf(entry);
          if (aMeta && eMeta && Number.isFinite(aMeta.lat) && Number.isFinite(aMeta.lng)) {
            const w = await walkLeg(aMeta.lat, aMeta.lng, eMeta.lat, eMeta.lng);
            newLegs.push({
              kind: 'walk', from: alightStop, to: entry,
              meters: w.meters, minutes: w.minutes,
              geometry: w.geometry, routed: w.routed,
            });
          }
        }
      } else if (walkOut) {
        newLegs.push(walkOut);
      }
      for (const l of rideLegs) newLegs.push(l);
      for (const l of transferWalks) newLegs.push(l);
      if (postBus) {
        // v52.2 — postBus.legs[0] is a walk from 'origin' to the nearest
        // bus stop near `exit`; we already fit that walk into the journey by
        // walking from `exit` (rail exit) to the bus boarding stop. Drop
        // postBus.legs[0] and keep the rest (ride + walkIn to user's dest).
        const exitMeta = entryMetaOf(exit);
        const firstLeg = postBus.legs[0];
        const busBoardingStop = (firstLeg && firstLeg.kind === 'walk') ? firstLeg.to : null;
        if (exitMeta && busBoardingStop && busBoardingStop !== exit) {
          const busBoardingMeta = stopLatLng(idx, busBoardingStop);
          if (busBoardingMeta && Number.isFinite(busBoardingMeta.lat)) {
            const w = await walkLeg(exitMeta.lat, exitMeta.lng, busBoardingMeta.lat, busBoardingMeta.lng);
            newLegs.push({
              kind: 'walk', from: exit, to: busBoardingStop,
              meters: w.meters, minutes: w.minutes,
              geometry: w.geometry, routed: w.routed,
            });
          }
        }
        for (let i = 1; i < postBus.legs.length; i++) newLegs.push(postBus.legs[i]);
      } else if (walkIn) {
        newLegs.push(walkIn);
      }
      out.push({
        legs: newLegs,
        totalMin: newLegs.reduce((s, l) => s + (l && l.minutes ? l.minutes : 0), 0),
        kind: rj.kind,
        // Preserve the rail routing metadata so the UI shows the right
        // strategy tag (rail vs. mixed). We mark _mixed=true so the
        // strategyOf classifier can promote the journey to the mixed
        // bucket.
        _mixedRailCo: railCo,
        _entry: entry,
        _exit: exit,
      });
    }
    return out;
  }

  // ---- Top-level search ----------------------------------------------
  async function search(originStop, destStop) {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    _resetReq();

    const idx = (window.state && window.state.index) || null;
    if (!idx) {
      return { direct: [], oneTransfer: [], twoTransfer: [], error: 'noIndex' };
    }

    // Normalise inputs
    const origin = {
      stop: String(originStop),
      lat: NaN, lng: NaN,
    };
    const dest = {
      stop: String(destStop),
      lat: NaN, lng: NaN,
    };
    const oMeta = stopMeta(idx, origin.stop);
    const dMeta = stopMeta(idx, dest.stop);
    if (oMeta) { if (Number.isFinite(oMeta.lat)) origin.lat = oMeta.lat; if (Number.isFinite(oMeta.lng)) origin.lng = oMeta.lng; }
    if (dMeta) { if (Number.isFinite(dMeta.lat)) dest.lat = dMeta.lat; if (Number.isFinite(dMeta.lng)) dest.lng = dMeta.lng; }

    if (origin.stop === dest.stop) {
      return { direct: [], oneTransfer: [], twoTransfer: [], sameStop: true };
    }

    // v43 — short-circuit the bus sub-planners when both stops are MTR or
    // LRT stations. Without this, findDirect() falls back to
    // collapseRouteVariants() and iterates ALL ~1,100 KMB/CTB routes
    // checking whether each one's stop list contains both stops — a pure
    // waste because no bus route serves two MTR stations. Skipping the
    // bus work makes pure-rail searches effectively instant (Dijkstra
    // over the 97-station graph is sub-millisecond) and avoids polluting
    // the localStorage route-stop cache with entries we will never use.
    const originIsRail = !!(idx.mtr && idx.mtr.has(origin.stop)) ||
                          !!(idx.lrt && idx.lrt.stops && idx.lrt.stops.has(origin.stop));
    const destIsRail = !!(idx.mtr && idx.mtr.has(dest.stop)) ||
                        !!(idx.lrt && idx.lrt.stops && idx.lrt.stops.has(dest.stop));
    const pureRail = originIsRail && destIsRail;

    // Direct first: this prefills `_routeStopsCache` for every candidate
    // route so the transfer searches can use the reverse index without
    // firing another batch of upstream calls.
    let busDirect, busTwoTransfer;
    let busOneTransfer;
    if (pureRail) {
      busDirect = [];
      busOneTransfer = [];
      busTwoTransfer = [];
    } else {
      busDirect = await findDirect(idx, origin, dest);
      [busOneTransfer, busTwoTransfer] = await Promise.all([
        findOneTransfer(idx, origin, dest),
        findTwoTransfer(idx, origin, dest),
      ]);
    }

    // ---- Rail (MTR / LRT) routes ------------------------------------
    // The bus planner cannot connect two MTR stations because no bus
    // route serves both. We run a separate graph router in parallel.
    // Cost is in-memory and bounded (~97 stations / 11 LRT routes) so
    // this is fast even on cold start.
    const [mtrRoutes, lrtRoutes] = await Promise.all([
      findMtrRoutes(idx, origin, dest),
      findLrtRoutes(idx, origin, dest),
    ]);
    // Capture rail-only arrays before we merge them with bus results so
    // v41's strategy view can show "rail-only" alternatives separately.
    const railDirect = [].concat(mtrRoutes.direct, lrtRoutes.direct);
    const railOneTransfer = [].concat(mtrRoutes.oneTransfer, lrtRoutes.oneTransfer);

    // ---- v52 — Mixed bus+rail journeys -------------------------------
    // For each rail journey, try to find direct buses from the user's
    // origin to the rail entry station and/or from the rail exit to
    // the user's destination. When found, splice them in place of the
    // cross-mode walks so the user sees realistic end-to-end trips
    // that mix bus and rail (e.g. "89K to 馬鞍山站 → MTR → 14X to
    // KT924"). Mixed candidates are computed for both MTR and LRT
    // rail outputs. Each mixed candidate costs 0-2 extra
    // findDirect() calls; the worst case is ~4 extra RTTs per search.
    const [mixedFromMtr, mixedFromLrt] = await Promise.all([
      buildMixedJourneys(idx, origin, dest,
        [].concat(mtrRoutes.direct, mtrRoutes.oneTransfer), 'MTR'),
      buildMixedJourneys(idx, origin, dest,
        [].concat(lrtRoutes.direct, lrtRoutes.oneTransfer), 'LRT'),
    ]);
    const mixedJourneys = [].concat(mixedFromMtr, mixedFromLrt);

    // ---- Mixed (current default) merge ------------------------------
    // Keep the legacy behaviour where rail legs are appended into the
    // direct + oneTransfer buckets so older callers of `Planner.search`
    // see the same shape. The Mixed strategy bucket reuses these arrays.
    let direct = busDirect.concat(railDirect);
    let oneTransfer = busOneTransfer.concat(railOneTransfer);
    const twoTransfer = busTwoTransfer;
    direct.sort((a, b) => a.totalMin - b.totalMin);
    oneTransfer.sort((a, b) => a.totalMin - b.totalMin);
    if (direct.length > DIRECT_LIMIT) direct = direct.slice(0, DIRECT_LIMIT);
    if (oneTransfer.length > ONE_TRANSFER_LIMIT) oneTransfer.length = ONE_TRANSFER_LIMIT;

    // ---- v41 route strategies (Bus / Rail / Mixed) -----------------
    // Each strategy is its own candidate set:
    //   - Bus: only journeys from findDirect / findOneTransfer (no rail)
    //   - Rail: only journeys from findMtrRoutes / findLrtRoutes (no bus)
    //   - Mixed: everything (the legacy default)
    // We classify each journey by mode composition and bucket into the
    // three strategies, then keep the top STRATEGY_LIMIT per bucket
    // sorted by totalMin. A `best` pointer lets the UI mark the rank-1
    // card in each section.
    const strategyOf = (j) => {
      let hasBus = false, hasRail = false;
      const legs = (j && j.legs) || [];
      for (const leg of legs) {
        if (leg.kind !== 'ride' || !leg.routeMeta) continue;
        const co = leg.routeMeta.co;
        if (co === 'MTR' || co === 'LRT') hasRail = true;
        else if (co === 'KMB' || co === 'LWB' ||
                 co === 'CTB' || co === 'NWFB' ||
                 co === 'GMB') hasBus = true;
      }
      if (hasRail && hasBus) return 'mixed';
      if (hasRail) return 'rail';
      if (hasBus) return 'bus';
      return 'mixed'; // pure-walk fallback (deferred feature)
    };
    const bucketOf = (j) => {
      const s = strategyOf(j);
      if (s === 'bus')   return 'bus';
      if (s === 'rail')  return 'rail';
      return 'mixed';
    };
    const buckets = { bus: [], rail: [], mixed: [] };
    // Bus-only feed draws from the bus sub-planners (no rail merge).
    for (const j of busDirect)      buckets[bucketOf(j)].push(j);
    for (const j of busOneTransfer)  buckets[bucketOf(j)].push(j);
    for (const j of busTwoTransfer)  buckets[bucketOf(j)].push(j);
    // Rail-only feed draws from the rail sub-planners (no bus merge).
    for (const j of railDirect)      buckets[bucketOf(j)].push(j);
    for (const j of railOneTransfer) buckets[bucketOf(j)].push(j);
    // Mixed feed draws from the fully-merged legacy arrays.
    for (const j of direct)          buckets[bucketOf(j)].push(j);
    for (const j of oneTransfer)     buckets[bucketOf(j)].push(j);
    for (const j of twoTransfer)     buckets[bucketOf(j)].push(j);
    // v52 — mixed bus+rail candidates (spliced into the merged arrays
    // so strategyOf() correctly classifies them as "mixed" — they have
    // at least one bus leg AND one rail leg). We append them to the
    // "direct" bucket of the merged legacy arrays so they're eligible
    // for the mixed bucket, and to the strategyOf view via direct.
    for (const j of mixedJourneys) {
      direct.push(j);
      buckets[bucketOf(j)].push(j);
    }

    const strategies = { bus: { journeys: [], best: null }, rail: { journeys: [], best: null }, mixed: { journeys: [], best: null } };
    for (const k of Object.keys(buckets)) {
      const arr = buckets[k]
        .slice()
        .sort((a, b) => a.totalMin - b.totalMin)
        .slice(0, STRATEGY_LIMIT);
      strategies[k] = { journeys: arr, best: arr[0] || null };
    }

    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const elapsed = Math.round(t1 - t0);
    // Single line, easy to grep / spot regressions in DevTools.
    // Format: planner.search | N requests | Nms | direct=… one=… two=… cache=…
    try {
      // v42 — extended log: cov = number of strategies with ≥1 journey
      // (e.g. "1" = only bus fired, "3" = all three strategies fired).
      // empty = 1 when the user got the no-results state.
      const coveredStrats = Object.keys(strategies).filter((k) => strategies[k].journeys.length > 0).length;
      const empty = coveredStrats === 0 ? 1 : 0;
      console.log(
        `planner.search | req=${_reqCounter} | ${elapsed}ms ` +
        `| direct=${direct.length} one=${oneTransfer.length} two=${twoTransfer.length} ` +
        `| strategy bus=${strategies.bus.journeys.length} ` +
        `rail=${strategies.rail.journeys.length} ` +
        `mixed=${strategies.mixed.journeys.length} ` +
        `| cov=${coveredStrats} empty=${empty} ` +
        `| cache rs=${_routeStopsCache.size} sr=${_stopRoutesCache.size} ` +
        `| rail mtr=${mtrRoutes.direct.length + mtrRoutes.oneTransfer.length} ` +
        `lrt=${lrtRoutes.direct.length + lrtRoutes.oneTransfer.length}`
      );
    } catch (e) { /* console may be missing */ }

    return { direct, oneTransfer, twoTransfer, origin, dest, strategies };
  }

  // ---- UI helpers (depend on the parent's el()/t_str() helpers) -----
  function el(tag, attrs, ...rest) {
    const node = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'style') node.setAttribute('style', v);
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of rest.flat()) {
      if (c == null || c === false) continue;
      node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  function t_str(key, ...args) {
    const STRINGS = window.STRINGS || {};
    const lang = (window.state && window.state.lang) || 'zh-Hant';
    const s = STRINGS[lang] && STRINGS[lang][key];
    if (typeof s === 'function') return s(...args);
    return s == null ? key : s;
  }

  // Extend the shared i18n dict with planner-only keys so we don't have to
  // touch app.js. Idempotent on re-entry; missing locales get the same
  // default so the dropdown is never blank.
  function patchPlannerStrings() {
    const S = window.STRINGS = window.STRINGS || {};
    const ensure = (lang, k, v) => {
      S[lang] = S[lang] || {};
      if (S[lang][k] == null) S[lang][k] = v;
    };
    ensure('zh-Hant', 'plannerSuggestEmpty', '搵唔到匹配嘅車站，試下其他字。');
    ensure('en',      'plannerSuggestEmpty', 'No matching stops. Try other characters.');
    ensure('zh-Hans', 'plannerSuggestEmpty', '未找到匹配嘅车站，试下其他字。');
    ensure('zh-Hant', 'plannerSuggestSectionMtr', '港鐵站');
    ensure('en',      'plannerSuggestSectionMtr', 'MTR / Light Rail');
    ensure('zh-Hans', 'plannerSuggestSectionMtr', '港铁站');
    ensure('zh-Hant', 'plannerSuggestSectionBus', '巴士站');
    ensure('en',      'plannerSuggestSectionBus', 'Bus & minibus stops');
    ensure('zh-Hans', 'plannerSuggestSectionBus', '巴士站');
    ensure('zh-Hant', 'plannerSuggestDistance', (km) => `約 ${km.toFixed(1)} 公里`);
    ensure('en',      'plannerSuggestDistance', (km) => `~${km.toFixed(1)} km`);
    ensure('zh-Hans', 'plannerSuggestDistance', (km) => `约 ${km.toFixed(1)} 公里`);
    ensure('zh-Hant', 'plannerSuggestAria', (q) => `車站建議，輸入緊「${q}」`);
    ensure('en',      'plannerSuggestAria', (q) => `Stop suggestions for "${q}"`);
    ensure('zh-Hans', 'plannerSuggestAria', (q) => `车站建议，输入紧「${q}」`);
    ensure('zh-Hant', 'plannerDepartNow',  '現在出發');
    ensure('en',      'plannerDepartNow',  'Depart now');
    ensure('zh-Hans', 'plannerDepartNow',  '现在出发');
    ensure('zh-Hant', 'plannerDepartBy',   '指定時間出發');
    ensure('en',      'plannerDepartBy',   'Depart by time');
    ensure('zh-Hans', 'plannerDepartBy',   '指定时间出发');
    ensure('zh-Hant', 'plannerArriveBy',   '目標到達時間');
    ensure('en',      'plannerArriveBy',   'Target arrival time');
    ensure('zh-Hans', 'plannerArriveBy',   '目标到达时间');
    ensure('zh-Hant', 'plannerDepartAt',   '出發時間');
    ensure('en',      'plannerDepartAt',   'Departure time');
    ensure('zh-Hans', 'plannerDepartAt',   '出发时间');
    ensure('zh-Hant', 'plannerNeedLeaveBy', (hhmm) => `需 ${hhmm} 出發`);
    ensure('en',      'plannerNeedLeaveBy', (hhmm) => `Leave by ${hhmm}`);
    ensure('zh-Hans', 'plannerNeedLeaveBy', (hhmm) => `需 ${hhmm} 出发`);
    // v47 — meta-row walk-minute prefix. Reads as "步行 0.3 km · 約 4 分鐘".
    ensure('zh-Hant', 'plannerWalkMinPrefix', '約 ');
    ensure('en',      'plannerWalkMinPrefix', '~');
    ensure('zh-Hans', 'plannerWalkMinPrefix', '约 ');
    // v41 — route strategy sections (Bus / Rail / Mixed).
    ensure('zh-Hant', 'plannerStrategyBus',   '巴士');
    ensure('en',      'plannerStrategyBus',   'Bus');
    ensure('zh-Hans', 'plannerStrategyBus',   '巴士');
    ensure('zh-Hant', 'plannerStrategyRail',  '港鐵 / 輕鐵');
    ensure('en',      'plannerStrategyRail',  'Rail');
    ensure('zh-Hans', 'plannerStrategyRail',  '港铁 / 轻铁');
    ensure('zh-Hant', 'plannerStrategyMixed', '混合');
    ensure('en',      'plannerStrategyMixed', 'Mixed');
    ensure('zh-Hans', 'plannerStrategyMixed', '混合');
    // Per-strategy card tag labels — short, ≤4 glyphs.
    ensure('zh-Hant', 'plannerStrategyTagBus',   '巴士');
    ensure('en',      'plannerStrategyTagBus',   'BUS');
    ensure('zh-Hans', 'plannerStrategyTagBus',   '巴士');
    ensure('zh-Hant', 'plannerStrategyTagRail',  '港鐵');
    ensure('en',      'plannerStrategyTagRail',  'RAIL');
    ensure('zh-Hans', 'plannerStrategyTagRail',  '港铁');
    ensure('zh-Hant', 'plannerStrategyTagMixed', '混合');
    ensure('en',      'plannerStrategyTagMixed', 'MIX');
    ensure('zh-Hans', 'plannerStrategyTagMixed', '混合');
  }
  patchPlannerStrings();

  function nameFor(obj) {
    if (!obj) return '';
    if (window.nameFor) return window.nameFor(obj);
    const lang = (window.state && window.state.lang) || 'zh-Hant';
    const wantTc = lang !== 'zh-Hans';
    const tc = obj.name_tc || obj.nameTc || '';
    const sc = obj.name_sc || obj.nameSc || '';
    const en = obj.name_en || obj.nameEn || '';
    if (lang === 'en') return en || tc || sc;
    if (wantTc) return tc || sc || en;
    return sc || tc || en;
  }

  // Find the parent app's `el` if it is exposed.
  function appEl() {
    return window.el || el;
  }
  function appStr(key, ...args) {
    if (window.t_str) return window.t_str(key, ...args);
    return t_str(key, ...args);
  }

  // ---- Autocomplete (mini search) ------------------------------------
  function searchStopsLite(q) {
    if (!q || !window.state || !window.state.index) return [];
    const idx = window.state.index;
    const lower = q.toLowerCase();
    const norm = (s) => (s || '').toLowerCase();
    const out = [];
    const seen = new Set();
    const push = (data) => {
      const key = data.stop + '|' + (data.co || '');
      if (seen.has(key)) return;
      seen.add(key);
      out.push(data);
    };
    idx.stops.forEach((s) => {
      const text = `${norm(s.nameTc)} ${norm(s.nameEn)} ${norm(s.nameSc || '')}`;
      const textLower = text.toLowerCase();
      let score = 0;
      if (String(s.stop).toLowerCase() === lower) score += 100;
      else if (String(s.stop).toLowerCase().includes(lower)) score += 30;
      if (textLower.includes(lower)) score += 10;
      if (textLower.startsWith(lower)) score += 20;
      if (score > 0) push({ ...s, _score: score });
    });
    idx.mtr.forEach((s, code) => {
      if (s._isLine) return;
      const text = `${norm(s.nameTc)} ${norm(s.nameEn)}`;
      let score = 0;
      if (String(code).toLowerCase() === lower) score += 100;
      else if (text.toLowerCase().includes(lower)) score += 10;
      if (score > 0) {
        // Carry lat/lng so the suggestion row can show distance from
        // the user's location when available.
        push({
          co: 'MTR', stop: code,
          nameTc: s.nameTc, nameEn: s.nameEn, nameSc: '',
          lat: Number.isFinite(s.lat) ? s.lat : null,
          lng: Number.isFinite(s.lng) ? s.lng : null,
          _score: score,
        });
      }
    });
    // Light Rail stops: short numeric IDs, both Traditional Chinese and
    // English names. They live under `state.index.lrt.stops`.
    if (idx.lrt && idx.lrt.stops) {
      idx.lrt.stops.forEach((s, code) => {
        const text = `${norm(s.nameTc)} ${norm(s.nameEn)}`;
        let score = 0;
        if (String(code).toLowerCase() === lower) score += 100;
        else if (text.toLowerCase().includes(lower)) score += 10;
        if (text.toLowerCase().startsWith(lower)) score += 20;
        if (score > 0) {
          push({
            co: 'LRT', stop: code,
            nameTc: s.nameTc, nameEn: s.nameEn, nameSc: '',
            _score: score,
          });
        }
      });
    }
    return out.sort((a, b) => b._score - a._score).slice(0, 8);
  }

  // ---- Render journey cards -----------------------------------------
  function buildLegsStrip(legs) {
    const wrap = el('div', { class: 'planner-legs' });
    legs.forEach((l) => {
      const node = el('div', { class: 'planner-leg' });
      const icon = el('span', { class: 'leg-icon' });
      if (l.kind === 'walk') {
        icon.textContent = l.transfer ? '↔' : '↦';
      } else {
        icon.textContent = l.routeMeta ? (l.routeMeta.route || 'B') : 'B';
      }
      node.appendChild(icon);
      const text = el('div');
      let label = '';
      if (l.kind === 'walk') {
        if (l.from === 'origin') {
          label = `${t_str('plannerWalk')} → ${stopNameFromState(l.to)}`;
        } else if (l.to === 'dest') {
          label = `${stopNameFromState(l.from)} → ${t_str('plannerWalk')}`;
        } else if (l.transfer && l.from === l.to) {
          // Rail transfer at the same station — show the line swap so
          // it's clear what the user is changing onto.
          const here = stopNameFromState(l.from);
          const prevLine = l._fromLineName || '';
          const nextLine = l._toLineName   || '';
          if (prevLine && nextLine && prevLine !== nextLine) {
            label = `${here} · ${prevLine} → ${nextLine}`;
          } else {
            label = `${here} ↔ ${here}`;
          }
        } else {
          label = `${stopNameFromState(l.from)} ↔ ${stopNameFromState(l.to)}`;
        }
      } else {
        const rm = l.routeMeta || {};
        const co = rm.co || '';
        // MTR / LRT legs read better with the line/route name (e.g.
        // "港島綫 · 金鐘 → 中環") than with the bare operator+code.
        if (co === 'MTR' || co === 'LRT') {
          const lineName = pickLineName(rm);
          const fromName = stopNameFromState(l.from);
          const toName   = stopNameFromState(l.to);
          if (lineName) {
            label = `${lineName} · ${fromName} → ${toName}`;
          } else {
            label = `${t_str('plannerBoard')} ${co} ${rm.route || ''} · ${fromName} → ${toName}`;
          }
        } else {
          label = `${t_str('plannerBoard')} ${co} ${rm.route || ''}`;
        }
      }
      const textEl = el('div', { class: 'leg-text' }, label);
      text.appendChild(textEl);
      if (l.kind === 'walk') {
        // v47 — show walk minutes alongside distance so users see how
        // long the walk actually takes. Falls back to distance-only when
        // minutes is missing (legacy journeys from a stale cache).
        const dist = fmtDistance(l.meters || 0);
        if (Number.isFinite(l.minutes) && l.minutes > 0) {
          const walkMin = mins(l.minutes);
          const sub = l.routed ? `${dist} · ${walkMin}` : `${dist} · ≈ ${walkMin}`;
          text.appendChild(el('div', { class: 'leg-sub' }, sub));
        } else {
          text.appendChild(el('div', { class: 'leg-sub' }, dist));
        }
      } else {
        const rm = l.routeMeta || {};
        const co = rm.co || '';
        // Rail legs have `meters: 0` because we don't compute km. Show
        // minutes instead of "0 m" so the user understands how long the
        // ride is at a glance. When `l.fare` is set (MTR / LRT rides
        // only — sourced from assets/mtr-fares.json / lrt-fares.json),
        // append `· $X.X` so the user has an at-a-glance cost estimate.
        if (co === 'MTR' || co === 'LRT') {
          const rideParts = [`${t_str('plannerRide')} · ${mins(l.minutes)} ${t_str('minShort')}`];
          if (Number.isFinite(l.fare)) rideParts.push(`$${Number(l.fare).toFixed(1)}`);
          text.appendChild(el('div', { class: 'leg-sub' }, rideParts.join(' · ')));
        } else {
          text.appendChild(el('div', { class: 'leg-sub' },
            `${t_str('plannerRide')} ${fmtDistance(l.meters || 0)}`));
        }
      }
      node.appendChild(text);
      const eta = el('span', { class: 'leg-eta' }, `${mins(l.minutes)} ${t_str('minShort')}`);
      node.appendChild(eta);
      wrap.appendChild(node);
    });
    return wrap;
  }

  // Pick the best display name for a rail line / route, honouring the
  // active language. Falls back to the code when nothing's available.
  function pickLineName(rm) {
    if (!rm) return '';
    const lang = (window.state && window.state.lang) || 'zh-Hant';
    if (lang === 'en') {
      return rm.origEn || rm.origTc || rm.route || '';
    }
    return rm.origTc || rm.origEn || rm.route || '';
  }

  function stopNameFromState(stopId) {
    const idx = window.state && window.state.index;
    if (!idx) return stopId;
    return stopName(idx, stopId);
  }

  // ---- v42 — Route-shape canvas -------------------------------------
  // Render the journey's ride legs as an inline SVG polyline + markers so
  // each card visually distinguishes its route. Coordinates come from
  // `stopLatLng` (already used elsewhere) and per-co colour rules reuse
  // the existing `.planner-chip.co-X` palette via SVG class names.
  const CANVAS_W = 120;
  const CANVAS_H = 80;
  const CANVAS_PAD = 8;        // px around the bounding box
  function buildJourneyCanvas(legs) {
    const idx = window.state && window.state.index;
    if (!idx) return null;
    // Collect one (lat, lng, co) per ride-leg endpoint. Intermediate stops
    // on multi-station rides would be a nice-to-have; for the first cut we
    // just connect from → to which is enough to make 5 bus routes that
    // all take 33 min visually distinguishable.
    const pts = []; // { lat, lng, co }
    for (const l of legs) {
      if (l.kind !== 'ride') continue;
      const fromLL = stopLatLng(idx, l.from);
      const toLL = stopLatLng(idx, l.to);
      const co = (l.routeMeta && l.routeMeta.co) || 'BUS';
      if (fromLL) pts.push({ lat: fromLL.lat, lng: fromLL.lng, co });
      if (toLL) pts.push({ lat: toLL.lat, lng: toLL.lng, co });
    }
    // v47 — also seed the bounding box with real walking geometry when
    // present, so the canvas doesn't clip the walk lines. We only need
    // the geometry for the bbox here; the actual walk polylines are
    // drawn later in the function.
    for (const l of legs) {
      if (l.kind !== 'walk') continue;
      if (!l.geometry) continue;
      // Sample a subset of points to keep the bbox pass cheap for very
      // long paths (TSW→CEN returns ~916 waypoints).
      const step = Math.max(1, Math.floor(l.geometry.length / 24));
      for (let i = 0; i < l.geometry.length; i += step) {
        pts.push({ lat: l.geometry[i].lat, lng: l.geometry[i].lng, co: '__walk__' });
      }
      // Always include the last waypoint so the bbox closes correctly.
      const last = l.geometry[l.geometry.length - 1];
      if (last) pts.push({ lat: last.lat, lng: last.lng, co: '__walk__' });
    }
    // Dedupe consecutive identical points (back-to-back legs on same stop).
    const uniq = [];
    for (const p of pts) {
      const last = uniq[uniq.length - 1];
      if (last && last.lat === p.lat && last.lng === p.lng) continue;
      uniq.push(p);
    }
    if (uniq.length < 2) return null;

    // Bounding box with padding.
    let minLat = uniq[0].lat, maxLat = uniq[0].lat;
    let minLng = uniq[0].lng, maxLng = uniq[0].lng;
    for (const p of uniq) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
    // Avoid div-by-zero when all ride-leg endpoints share a lat/lng
    // (degenerate case; the algorithm would have rejected such a route
    // upstream, but defensive here keeps the SVG from collapsing).
    const latSpan = Math.max(maxLat - minLat, 1e-6);
    const lngSpan = Math.max(maxLng - minLng, 1e-6);
    // Project to (x, y). SVG y is inverted (north → smaller y).
    const project = (lat, lng) => {
      const x = CANVAS_PAD + ((lng - minLng) / lngSpan) * (CANVAS_W - 2 * CANVAS_PAD);
      const y = CANVAS_PAD + (1 - (lat - minLat) / latSpan) * (CANVAS_H - 2 * CANVAS_PAD);
      return [x, y];
    };
    // Build per-leg polylines so each ride leg inherits its operator's
    // colour via .co-X rules.
    const lines = [];
    let firstPts = null;
    for (const l of legs) {
      if (l.kind !== 'ride') continue;
      const fromLL = stopLatLng(idx, l.from);
      const toLL = stopLatLng(idx, l.to);
      if (!fromLL || !toLL) continue;
      const co = (l.routeMeta && l.routeMeta.co) || 'BUS';
      const [x1, y1] = project(fromLL.lat, fromLL.lng);
      const [x2, y2] = project(toLL.lat, toLL.lng);
      lines.push({ co, x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2) });
      if (firstPts == null) firstPts = [x1, y1, co];
    }
    if (lines.length === 0) return null;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'planner-card-canvas');
    svg.setAttribute('viewBox', `0 0 ${CANVAS_W} ${CANVAS_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    // One polyline per ride leg, coloured by operator.
    for (const ln of lines) {
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      polyline.setAttribute('x1', ln.x1); polyline.setAttribute('y1', ln.y1);
      polyline.setAttribute('x2', ln.x2); polyline.setAttribute('y2', ln.y2);
      polyline.setAttribute('class', `planner-canvas-line co-${ln.co}`);
      svg.appendChild(polyline);
    }
    // v47 — draw real walking paths for any walk leg that has geometry.
    // We render these BEFORE the dashed corner-anchor lines so the
    // dashed corner anchor only fires for legs without geometry (the
    // current-state fallback when GraphHopper is unreachable).
    let drewWalkPolyline = false;
    for (const l of legs) {
      if (l.kind !== 'walk') continue;
      if (!l.geometry || l.geometry.length < 2) continue;
      // Build the polyline points; downsample very long geometries so the
      // SVG doesn't blow up with thousands of <line> segments.
      const step = Math.max(1, Math.floor(l.geometry.length / 32));
      const pts2 = [];
      for (let i = 0; i < l.geometry.length; i += step) {
        pts2.push(project(l.geometry[i].lat, l.geometry[i].lng));
      }
      const last = l.geometry[l.geometry.length - 1];
      if (last) pts2.push(project(last.lat, last.lng));
      // Emit one <line> per consecutive pair so the existing
      // .planner-canvas-walk-routed CSS styling lights up uniformly.
      for (let i = 0; i < pts2.length - 1; i++) {
        const [x1, y1] = pts2[i];
        const [x2, y2] = pts2[i + 1];
        const seg = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        seg.setAttribute('x1', x1.toFixed(2));
        seg.setAttribute('y1', y1.toFixed(2));
        seg.setAttribute('x2', x2.toFixed(2));
        seg.setAttribute('y2', y2.toFixed(2));
        seg.setAttribute('class', 'planner-canvas-walk planner-canvas-walk-routed');
        svg.appendChild(seg);
      }
      drewWalkPolyline = true;
    }
    // v44 — keep the dashed corner-anchor walk line as the fallback when
    // no real geometry is available (or the leg's walk is short and we
    // didn't bother to fetch). We only fall back per-leg, so a journey
    // with one routed walk and one unrouted walk draws the routed walk
    // polyline AND a dashed line for the unrouted one.
    const firstLeg = legs[0];
    const lastLeg = legs[legs.length - 1];
    // Origin / destination dots and walk-out line both read from the
    // first/last ride dot's coords + operator. Declared once here so
    // the walk-out `if` block can reference them and the origin-dot
    // code below doesn't need to redeclare.
    const [ox, oy, oco] = firstPts;
    const lastLn = lines[lines.length - 1];
    if (firstLeg && firstLeg.kind === 'walk' && firstLeg.from === 'origin' &&
        !(firstLeg.geometry && firstLeg.geometry.length > 1)) {
      // Anchor at the top-left corner — a "you came from off-canvas".
      const ax = CANVAS_PAD, ay = CANVAS_PAD;
      const w = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      w.setAttribute('x1', ax.toFixed(2)); w.setAttribute('y1', ay.toFixed(2));
      w.setAttribute('x2', ox); w.setAttribute('y2', oy);
      w.setAttribute('class', 'planner-canvas-walk');
      svg.appendChild(w);
    }
    if (lastLeg && lastLeg.kind === 'walk' && lastLeg.to === 'dest' && lines.length > 0 &&
        !(lastLeg.geometry && lastLeg.geometry.length > 1)) {
      // Anchor at the bottom-right corner.
      const ax = CANVAS_W - CANVAS_PAD, ay = CANVAS_H - CANVAS_PAD;
      const w = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      w.setAttribute('x1', lastLn.x2); w.setAttribute('y1', lastLn.y2);
      w.setAttribute('x2', ax.toFixed(2)); w.setAttribute('y2', ay.toFixed(2));
      w.setAttribute('class', 'planner-canvas-walk');
      svg.appendChild(w);
    }
    // Origin / destination dots use the FIRST/LAST ride leg's operator
    // colour so they blend with the polyline they belong to. (ox/oy/oco
    // were declared above for the walk-out if-block; d/dy/dco are local
    // to this section since the destination dot has its own slot.)
    const last = lines[lines.length - 1];
    const [dx, dy, dco] = [last.x2, last.y2, last.co];
    const oDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    oDot.setAttribute('cx', ox); oDot.setAttribute('cy', oy); oDot.setAttribute('r', '3');
    oDot.setAttribute('class', `planner-canvas-dot dot--origin co-${oco}`);
    svg.appendChild(oDot);
    const dDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dDot.setAttribute('cx', dx); dDot.setAttribute('cy', dy); dDot.setAttribute('r', '3');
    dDot.setAttribute('class', `planner-canvas-dot dot--dest co-${dco}`);
    svg.appendChild(dDot);
    return svg;
  }

  function buildJourneyCard(rank, journey, opts) {
    const card = el('article', { class: 'planner-card' + (rank === 1 ? ' is-best' : '') });
    card.appendChild(el('div', { class: 'planner-card-rank' }, String(rank)));

    const main = el('div', { class: 'planner-card-main' });

    const head = el('div', { class: 'planner-card-head' });
    const routes = el('div', { class: 'planner-card-routes' });
    const rideLegs = journey.legs.filter((l) => l.kind === 'ride');
    rideLegs.forEach((l, i) => {
      const rm = l.routeMeta || {};
      const co = rm.co || 'BUS';
      const label = rm.route || '';
      const title = pickLineName(rm) || label;
      routes.appendChild(el('span', {
        class: `planner-chip co-${co}`,
        title: title || label,
      }, label));
      if (i < rideLegs.length - 1) routes.appendChild(el('span', { class: 'planner-card-arrow' }, '→'));
    });
    head.appendChild(routes);
    if (opts.bestBadge) {
      head.appendChild(el('span', { class: 'planner-chip', style: 'background: var(--accent); color:#fff; margin-left: 4px;' },
        t_str('plannerBest')));
    }
    if (opts.strategyTag) {
      // v41 — strategy badge next to the best-badge (or in its place if no
      // best-badge). Coloured to match the strategy section header.
      const tagKey = ({
        bus:   'plannerStrategyTagBus',
        rail:  'plannerStrategyTagRail',
        mixed: 'plannerStrategyTagMixed',
      })[opts.strategyTag] || null;
      if (tagKey) {
        head.appendChild(el('span', {
          class: `planner-strategy-tag is-${opts.strategyTag}`,
          title: t_str({
            bus:   'plannerStrategyBus',
            rail:  'plannerStrategyRail',
            mixed: 'plannerStrategyMixed',
          }[opts.strategyTag]),
        }, t_str(tagKey)));
      }
    }
    main.appendChild(head);

    // v42 — inline-SVG route-shape canvas. Sits between the chips header
    // and the meta row so the user sees the shape before reading the
    // numbers. Cheap enough to render per card (~5 polyline points for
    // most journeys) so no caching is needed.
    const canvas = buildJourneyCanvas(journey.legs);
    if (canvas) main.appendChild(canvas);

    // Summary meta row (total walk + walk minutes, total ride, transfer count).
    const walkLegs = journey.legs.filter((l) => l.kind === 'walk');
    const totalWalkM = walkLegs.reduce((s, l) => s + (l.meters || 0), 0);
    const totalWalkMin = walkLegs.reduce((s, l) => s + (Number.isFinite(l.minutes) ? l.minutes : 0), 0);
    const totalRideM = journey.legs.filter((l) => l.kind === 'ride').reduce((s, l) => s + (l.meters || 0), 0);
    const transfers = rideLegs.length - 1;
    const meta = el('div', { class: 'planner-card-meta' });
    // v47 — append walk minutes alongside the distance ("步行 0.3 km · 約 4 分鐘").
    // Omit the minutes when totalWalkM is 0 (no walk at all) to keep the
    // header compact for straight bus / rail pairs.
    if (totalWalkM > 0 && totalWalkMin > 0) {
      meta.appendChild(el('span', { class: 'item' },
        `${t_str('plannerWalk')} `,
        el('strong', {}, fmtDistance(totalWalkM)),
        ` · ${t_str('plannerWalkMinPrefix')}${mins(totalWalkMin)}`));
    } else {
      meta.appendChild(el('span', { class: 'item' }, `${t_str('plannerWalk')} `, el('strong', {}, fmtDistance(totalWalkM))));
    }
    meta.appendChild(el('span', { class: 'item' }, `${t_str('plannerRide')} `, el('strong', {}, fmtDistance(totalRideM))));
    if (transfers > 0) {
      meta.appendChild(el('span', { class: 'item' }, `${t_str('plannerTransfers')} `,
        el('strong', {}, String(transfers))));
    }
    main.appendChild(meta);

    // Legs strip (collapsed by default; user can see by tapping the card).
    const stripEl = buildLegsStrip(journey.legs);
    main.appendChild(stripEl);

    card.appendChild(main);

    // Time box (right column).
    const timeBox = el('div', { class: 'planner-card-time' });
    const big = el('span', { class: 'big' }, `${mins(journey.totalMin)} ${t_str('minShort')}`);
    if (journey.totalMin <= 2) big.classList.add('is-now');
    else if (journey.totalMin <= 15) big.classList.add('is-soon');
    timeBox.appendChild(big);
    // In "now" mode (default) we show the arrival time computed from now.
    // In "depart by HH:MM" mode we work backward from the user's target
    // arrival and show the latest departure time for THIS journey.
    if (opts.targetArrival) {
      const dep = computeDepartureTime(opts.targetArrival, journey.totalMin);
      const hhmm = dep ? formatHHMM(dep) : '--:--';
      timeBox.appendChild(el('span', { class: 'small' },
          t_str('plannerNeedLeaveBy', hhmm)));
    } else {
      const now = new Date();
      const eta = new Date(now.getTime() + journey.totalMin * 60000);
      const hh = String(eta.getHours()).padStart(2, '0');
      const mm = String(eta.getMinutes()).padStart(2, '0');
      timeBox.appendChild(el('span', { class: 'small' },
        `${t_str('plannerArrive')} ${hh}:${mm}`));
    }
    card.appendChild(timeBox);
    return card;
  }

  function buildSummary(direct, origin, dest) {
    const summary = el('section', { class: 'planner-summary' });
    const left = el('div', { class: 'planner-summary-main' });
    left.appendChild(el('div', { class: 'planner-summary-line' },
      el('span', { style: 'color: var(--accent);' }, '●'), stopNameFromState(origin.stop)));
    left.appendChild(el('div', { class: 'planner-summary-line' },
      el('span', { style: 'color: var(--accent-2);' }, '●'), stopNameFromState(dest.stop)));
    const sub = el('div', { class: 'planner-summary-sub' });
    if (direct.length === 0) {
      sub.textContent = t_str('plannerNoDirect');
    } else {
      sub.textContent = t_str('plannerDirectCount', direct.length);
    }
    left.appendChild(sub);
    summary.appendChild(left);
    if (direct.length > 0) {
      const right = el('div', { class: 'planner-summary-time' });
      const big = el('span', { class: 'big' }, `${mins(direct[0].totalMin)} ${t_str('minShort')}`);
      right.appendChild(big);
      right.appendChild(el('span', { class: 'small' }, t_str('plannerBestLabel')));
      // v42 — surface computed km alongside the best (lowest-totalMin)
      // journey so the user has a "how far?" answer next to "how long?".
      // Walks come from the walk-out/move-in meters; rides come from the
      // ride-leg meters summed across all ride legs.
      const sumMeters = (direct[0].legs || []).reduce((s, l) => {
        return s + (Number.isFinite(l.meters) ? l.meters : 0);
      }, 0);
      if (sumMeters > 0) {
        right.appendChild(el('span', { class: 'small planner-summary-km' },
          fmtDistance(sumMeters)));
      }
      summary.appendChild(right);
    }
    return summary;
  }

  function buildSection(title, count, color) {
    const sec = el('div', { class: 'planner-section' });
    sec.appendChild(el('h2', { class: 'planner-section-title', style: `color: ${color || 'var(--muted)'};` }, title));
    if (count != null) sec.appendChild(el('span', { class: 'planner-section-count' }, String(count)));
    return sec;
  }

  // ---- Top-level render ----------------------------------------------
  function renderPlanner(viewEl) {
    if (!viewEl) return;
    viewEl.innerHTML = '';
    const root = el('div', { class: 'container planner' });

    // ---- header ----
    const header = el('div', { class: 'planner-header' });
    const topbar = el('div', { class: 'planner-topbar' });
    topbar.appendChild(el('a', { class: 'planner-back', href: '#/', 'aria-label': t_str('back') },
      (() => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '22'); svg.setAttribute('height', '22');
        svg.setAttribute('aria-hidden', 'true');
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
        p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round'); p.setAttribute('d', 'M15 6l-6 6 6 6');
        svg.appendChild(p);
        return svg;
      })()
    ));
    header.appendChild(topbar);
    header.appendChild(el('h1', { class: 'planner-title' }, t_str('plannerTitle')));
    header.appendChild(el('p', { class: 'planner-subtitle' }, t_str('plannerSubtitle')));
    root.appendChild(header);

    // ---- form ----
    const form = el('form', { class: 'planner-form', autocomplete: 'off' });
    const originWrap = el('div', { class: 'planner-suggest-wrap' });
    const originInput = el('label', { class: 'planner-input is-origin' });
    originInput.appendChild(el('span', { class: 'planner-input-label' }, t_str('plannerFrom')));
    const originField = el('input', { type: 'search', placeholder: t_str('plannerFromPh'), autocomplete: 'off' });
    originInput.appendChild(originField);
    originWrap.appendChild(originInput);
    const originSuggest = el('div', { class: 'planner-suggest' });
    originWrap.appendChild(originSuggest);
    form.appendChild(originWrap);

    const swapBtn = el('button', {
      type: 'button',
      class: 'planner-swap',
      'aria-label': t_str('plannerSwap'),
      onclick: () => {
        // Swap the three pieces of state per field together: visible
        // label, the hidden stop id, and the `_selected` slot.
        const swapField = (src, dst) => {
          const label = src.value;
          const id    = src.dataset.stopId || null;
          src.value = dst.value;
          if (dst.dataset.stopId) src.setAttribute('data-stop-id', dst.dataset.stopId);
          else { delete src.dataset.stopId; src.removeAttribute('data-stop-id'); }
          dst.value = label;
          if (id) dst.setAttribute('data-stop-id', id);
          else { delete dst.dataset.stopId; dst.removeAttribute('data-stop-id'); }
        };
        swapField(originField, destField);
        const tmp = _selected.origin; _selected.origin = _selected.dest; _selected.dest = tmp;
        // Close any open dropdown — both fields are now "selected".
        originSuggestCtl.close();
        destSuggestCtl.close();
      },
    }, '↕');
    form.appendChild(swapBtn);

    const destWrap = el('div', { class: 'planner-suggest-wrap' });
    const destInput = el('label', { class: 'planner-input is-dest' });
    destInput.appendChild(el('span', { class: 'planner-input-label' }, t_str('plannerTo')));
    const destField = el('input', { type: 'search', placeholder: t_str('plannerToPh'), autocomplete: 'off' });
    destInput.appendChild(destField);
    destWrap.appendChild(destInput);
    const destSuggest = el('div', { class: 'planner-suggest' });
    destWrap.appendChild(destSuggest);
    form.appendChild(destWrap);

    // ---- selection state ----
    const _selected = { origin: null, dest: null };

    // ---- depart-by mode toggle + target arrival time picker ----
    // "現在出發" (now, default) and "指定時間出發" (target arrival). When the
    // user picks a target arrival time, each journey card shows the latest
    // departure time needed to arrive by that target (working backward
    // from `totalMin`).
    // `_hasRunOnce` flips true after the first successful journey calc so
    // changing mode or time re-runs the search. We don't want it to auto-
    // fire before both stops are selected.
    let _hasRunOnce = false;

    const modeRow = el('div', { class: 'planner-mode-row', role: 'radiogroup',
      'aria-label': t_str('plannerDepartNow') });
    const modeNowInput = el('input', { type: 'radio', name: 'planner-mode',
      value: 'now', id: 'planner-mode-now' });
    modeNowInput.checked = true;
    const modeByInput  = el('input', { type: 'radio', name: 'planner-mode',
      value: 'departBy', id: 'planner-mode-by' });
    const modeNowLabel = el('label', { class: 'planner-mode-opt is-active', for: 'planner-mode-now' },
      t_str('plannerDepartNow'));
    const modeByLabel  = el('label', { class: 'planner-mode-opt', for: 'planner-mode-by' },
      t_str('plannerDepartBy'));
    modeNowLabel.appendChild(modeNowInput);
    modeByLabel.appendChild(modeByInput);
    modeRow.appendChild(modeNowLabel);
    modeRow.appendChild(modeByLabel);
    form.appendChild(modeRow);

    const timeRow = el('div', { class: 'planner-time-row is-hidden',
      'aria-hidden': 'true' });
    const timeLabel = el('label', { class: 'planner-time-label', for: 'planner-target-time' },
      t_str('plannerArriveBy'));
    const timeField = el('input', { type: 'time', id: 'planner-target-time',
      class: 'planner-time-field', step: '60' });
    // Default target: 30 minutes from now, rounded up to next 5 minutes.
    const defaultTarget = new Date(Date.now() + 30 * 60000);
    defaultTarget.setMinutes(Math.ceil(defaultTarget.getMinutes() / 5) * 5, 0, 0);
    timeField.value = formatHHMM(defaultTarget);
    timeLabel.appendChild(timeField);
    timeRow.appendChild(timeLabel);
    form.appendChild(timeRow);

    const setDepartByMode = (on) => {
      modeNowInput.checked = !on;
      modeByInput.checked  = on;
      modeNowLabel.classList.toggle('is-active', !on);
      modeByLabel.classList.toggle('is-active',  on);
      timeRow.classList.toggle('is-hidden', !on);
      timeRow.setAttribute('aria-hidden', on ? 'false' : 'true');
    };
    modeNowLabel.addEventListener('click', () => {
      setDepartByMode(false);
      if (_hasRunOnce) runSearch();
    });
    modeByLabel.addEventListener('click', () => {
      setDepartByMode(true);
      if (_hasRunOnce) runSearch();
    });
    timeField.addEventListener('change', () => {
      if (_hasRunOnce) runSearch();
    });

    const submitRow = el('div', { class: 'planner-submit-row' });
    const submitBtn = el('button', { type: 'submit', class: 'planner-submit' }, t_str('plannerGo'));
    submitRow.appendChild(submitBtn);
    form.appendChild(submitRow);

    root.appendChild(form);

    // ---- results container ----
    const results = el('section', { class: 'planner-results' });
    root.appendChild(results);

    // ---- recent ----
    const recentSec = el('section', { class: 'planner-recent-section' });
    const recentTitle = el('h2', { class: 'section-title' }, t_str('plannerRecent'));
    recentSec.appendChild(recentTitle);
    const recentList = el('div', { class: 'planner-recent' });
    recentSec.appendChild(recentList);
    const refreshRecent = () => {
      recentList.innerHTML = '';
      const recents = (window.state && window.state.recent || []).filter((r) => r.kind === 'planner');
      if (recents.length === 0) {
        recentList.appendChild(el('p', { class: 'empty' }, t_str('plannerRecentEmpty')));
        return;
      }
      recents.slice(0, 8).forEach((r) => {
        const idx = window.state && window.state.index;
        const fromName = idx ? stopName(idx, r.from) : r.from;
        const toName   = idx ? stopName(idx, r.to)   : r.to;
        const a = el('a', { class: 'planner-recent-row', href: '#/planner' });
        a.appendChild(el('div', { class: 'from-to' },
          el('div', { class: 'pair' }, fromName, el('span', { class: 'sep' }, '→'), toName)));
        a.addEventListener('click', () => {
          // Mirror the selectMatch() pattern: keep `field.dataset.stopId`
          // in lock-step with `_selected`. Without this, runSearch()
          // prefers the stale `dataset.stopId` left over from the
          // initial-mount prefill and searches for the wrong stops,
          // producing a phantom "暫時搵唔到合適嘅路線" every time the
          // user clicks a recent row.
          originField.value = fromName;
          originField.dataset.stopId = String(r.from);
          originField.setAttribute('data-stop-id', String(r.from));
          destField.value = toName;
          destField.dataset.stopId = String(r.to);
          destField.setAttribute('data-stop-id', String(r.to));
          _selected.origin = r.from;
          _selected.dest = r.to;
          runSearch();
        });
        recentList.appendChild(a);
      });
    };
    refreshRecent();
    root.appendChild(recentSec);

    viewEl.appendChild(root);

    // ---- autocomplete (rebuilt for visibility + UX) --------------------
    // The previous wiring only *defined* attachAutocomplete but never
    // called it, so no input/focus/blur/keydown handlers were attached to
    // the fields. We attach once per field here, and the function below
    // also adds operator badges, distance (when geolocation is available),
    // debounced typing, and full keyboard nav.
    function operatorFor(match) {
      const code = match && match.co;
      if (code && code !== 'STOP') {
        const key = ({
          KMB: 'kmb', LWB: 'lwb', CTB: 'ctb', NWFB: 'nwfb',
          GMB: 'gmb', MTR: 'mtr', LRT: 'lrt',
        })[code] || null;
        return key ? { code, key } : null;
      }
      const id = String(match && match.stop || '');
      if (/^[A-Z]{2,4}$/.test(id)) return { code: 'MTR', key: 'mtr' };
      if (/^\d{1,3}$/.test(id))     return { code: 'LRT', key: 'lrt' };
      if (/^\d{8}$/.test(id))       return { code: 'KMB', key: 'kmb' };
      if (/^\d{6}$/.test(id))       return { code: 'CTB', key: 'ctb' };
      return null;
    }

    function attachAutocomplete(field, suggest, side) {
      let active = -1;
      let lastMatches = [];
      let debounceTimer = null;
      let blurTimer = null;

      function close() {
        suggest.classList.remove('is-open');
        suggest.innerHTML = '';
        active = -1;
        lastMatches = [];
        if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
      }

      function selectMatch(match) {
        if (!match) return;
        _selected[side] = String(match.stop);
        const label = nameFor(match) || String(match.stop);
        field.value = label;
        field.dataset.stopId = String(match.stop);
        field.setAttribute('data-stop-id', String(match.stop));
        close();
      }

      function paintRow(match, idx) {
        const row = el('div', {
          class: 'planner-suggest-row' + (idx === active ? ' is-active' : ''),
          dataset: { idx: String(idx), stopId: String(match.stop) },
          role: 'option',
          tabindex: '-1',
        });
        const op = operatorFor(match);
        const ll = (match && Number.isFinite(match.lat) && Number.isFinite(match.lng))
          ? { lat: match.lat, lng: match.lng } : null;
        const userLoc = (window.state && window.state.userLoc) || null;

        const title = el('div', { class: 'planner-suggest-title' }, nameFor(match) || String(match.stop));

        const sub = el('div', { class: 'planner-suggest-sub' });
        if (op) {
          sub.appendChild(el('span', {
            class: 'planner-suggest-op co-' + op.code,
            title: op.code,
          }, t_str(op.key)));
        }
        sub.appendChild(el('span', { class: 'planner-suggest-id' }, String(match.stop)));
        if (userLoc && ll) {
          const km = haversine(userLoc.lat, userLoc.lng, ll.lat, ll.lng);
          sub.appendChild(el('span', { class: 'planner-suggest-dist' },
            t_str('plannerSuggestDistance', km)));
        }
        row.appendChild(title);
        row.appendChild(sub);

        // Use mousedown (with preventDefault) so the input doesn't blur
        // first and close the panel before our click logic runs.
        row.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectMatch(match);
        });
        // Also accept touch / pointer up so taps on phones work even if
        // the browser fires `click` instead of `mousedown`.
        row.addEventListener('click', (e) => {
          e.preventDefault();
          selectMatch(match);
        });
        return row;
      }

      function paintSection(label) {
        return el('div', { class: 'planner-suggest-section' }, label);
      }

      function paintEmpty() {
        return el('div', { class: 'planner-suggest-empty' }, t_str('plannerSuggestEmpty'));
      }

      function render(matches) {
        suggest.innerHTML = '';
        active = -1;
        lastMatches = Array.isArray(matches) ? matches.slice() : [];
        if (lastMatches.length === 0) {
          suggest.appendChild(paintEmpty());
          suggest.classList.add('is-open');
          suggest.setAttribute('aria-label', t_str('plannerSuggestAria', field.value.trim()));
          return;
        }
        const mtr = lastMatches.filter((m) => (operatorFor(m) || {}).code === 'MTR'
          || (operatorFor(m) || {}).code === 'LRT');
        const bus = lastMatches.filter((m) => {
          const c = (operatorFor(m) || {}).code;
          return c !== 'MTR' && c !== 'LRT';
        });

        let runningIdx = 0;
        const paintOne = (m) => {
          suggest.appendChild(paintRow(m, runningIdx));
          lastMatches[runningIdx] = m; // keep in lock-step
          runningIdx++;
        };
        if (mtr.length > 0) {
          suggest.appendChild(paintSection(t_str('plannerSuggestSectionMtr')));
          mtr.forEach(paintOne);
        }
        if (bus.length > 0) {
          suggest.appendChild(paintSection(t_str('plannerSuggestSectionBus')));
          bus.forEach(paintOne);
        }
        // Reset runningIdx to the size of lastMatches (paintOne increments it).
        active = -1;
        suggest.classList.add('is-open');
        suggest.setAttribute('aria-label', t_str('plannerSuggestAria', field.value.trim()));
      }

      function schedule(query) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          const q = (query != null ? query : field.value).trim();
          if (!q) { close(); return; }
          render(searchStopsLite(q));
        }, 150);
      }

      field.setAttribute('autocomplete', 'off');
      field.setAttribute('autocorrect', 'off');
      field.setAttribute('autocapitalize', 'none');
      field.setAttribute('spellcheck', 'false');
      field.setAttribute('aria-autocomplete', 'list');
      field.setAttribute('aria-expanded', 'false');

      field.addEventListener('input', () => {
        _selected[side] = null;
        delete field.dataset.stopId;
        field.removeAttribute('data-stop-id');
        schedule();
      });

      field.addEventListener('focus', () => {
        if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
        if (_selected[side]) return;
        const q = field.value.trim();
        if (q) schedule(q);
      });

      field.addEventListener('blur', () => {
        if (blurTimer) clearTimeout(blurTimer);
        blurTimer = setTimeout(() => {
          blurTimer = null;
          close();
        }, 150);
      });

      field.addEventListener('keydown', (e) => {
        const rows = Array.from(suggest.querySelectorAll('.planner-suggest-row'));
        const isOpen = suggest.classList.contains('is-open');
        if (e.key === 'ArrowDown') {
          if (!isOpen) { schedule(); return; }
          if (rows.length === 0) return;
          active = Math.min(active + 1, rows.length - 1);
          rows.forEach((r, i) => r.classList.toggle('is-active', i === active));
          rows[active].scrollIntoView({ block: 'nearest' });
          e.preventDefault();
        } else if (e.key === 'ArrowUp') {
          if (!isOpen || rows.length === 0) return;
          active = Math.max(active - 1, 0);
          rows.forEach((r, i) => r.classList.toggle('is-active', i === active));
          rows[active].scrollIntoView({ block: 'nearest' });
          e.preventDefault();
        } else if (e.key === 'Enter') {
          if (isOpen && rows.length > 0 && active >= 0 && lastMatches[active]) {
            selectMatch(lastMatches[active]);
            e.preventDefault();
          }
          // If dropdown isn't open, let the form submit (default Enter).
        } else if (e.key === 'Escape') {
          if (isOpen) { close(); e.preventDefault(); }
        }
      });

      suggest.addEventListener('mousedown', (e) => {
        // Prevent the input from blurring (which would close the panel
        // before the row's own mousedown/click handler runs).
        e.preventDefault();
      });

      // Initial render: if there's a pre-filled value but nothing's
      // selected, show the matching suggestions right away.
      if (!_selected[side] && field.value.trim()) schedule(field.value.trim());

      return {
        refresh: () => schedule(field.value.trim()),
        close,
      };
    }

    const originSuggestCtl = attachAutocomplete(originField, originSuggest, 'origin');
    const destSuggestCtl   = attachAutocomplete(destField,   destSuggest,   'dest');

    // Pre-fill from the recent planner entry (if any) when the view first
    // opens. The user can still type a new query.
    const lastPlanner = (window.state && window.state.recent || []).find((r) => r.kind === 'planner');
    if (lastPlanner) {
      const idx = window.state && window.state.index;
      originField.value = idx ? stopName(idx, lastPlanner.from) : lastPlanner.from;
      originField.dataset.stopId = String(lastPlanner.from);
      originField.setAttribute('data-stop-id', String(lastPlanner.from));
      destField.value = idx ? stopName(idx, lastPlanner.to) : lastPlanner.to;
      destField.dataset.stopId = String(lastPlanner.to);
      destField.setAttribute('data-stop-id', String(lastPlanner.to));
      _selected.origin = lastPlanner.from;
      _selected.dest = lastPlanner.to;
    }

    // ---- search ----
    async function runSearch() {
      // Resolve origin / dest. Prefer the operator stop id stashed on the
      // input, then the `_selected` slot from the dropdown, then fall back
      // to a fresh `searchStopsLite` lookup against the typed text.
      let originId = originField.dataset.stopId || _selected.origin;
      let destId   = destField.dataset.stopId   || _selected.dest;
      if (!originId) {
        const matches = searchStopsLite(originField.value.trim());
        if (matches.length > 0) { originId = matches[0].stop; _selected.origin = originId; }
      }
      if (!destId) {
        const matches = searchStopsLite(destField.value.trim());
        if (matches.length > 0) { destId = matches[0].stop; _selected.dest = destId; }
      }
      if (!originId || !destId) {
        results.innerHTML = '';
        results.appendChild(el('div', { class: 'planner-empty' },
          el('p', {}, t_str('plannerNoStops'))));
        return;
      }

      submitBtn.disabled = true;
      results.innerHTML = '';
      results.appendChild(el('div', { class: 'planner-loading' },
        el('div', { class: 'spinner' }), el('span', {}, t_str('plannerSearching'))));

      try {
        const result = await search(originId, destId);
        results.innerHTML = '';

        if (result.error === 'noIndex') {
          results.appendChild(el('div', { class: 'planner-empty' },
            el('p', {}, t_str('fetchFailed'))));
          submitBtn.disabled = false;
          return;
        }

        if (result.sameStop) {
          results.appendChild(el('div', { class: 'planner-empty' },
            el('p', {}, t_str('plannerSameStop'))));
          submitBtn.disabled = false;
          return;
        }

        const idx = window.state && window.state.index;
        const originLL = idx && stopLatLng(idx, originId);
        const destLL = idx && stopLatLng(idx, destId);
        const origin = { stop: originId, lat: originLL ? originLL.lat : NaN, lng: originLL ? originLL.lng : NaN };
        const dest = { stop: destId, lat: destLL ? destLL.lat : NaN, lng: destLL ? destLL.lng : NaN };

        // In "depart by HH:MM" mode we pass a target arrival date through to
        // each journey card so it can show the latest recommended departure
        // time (target − totalMin). In default ("now") mode we pass nothing
        // and the card shows arrival from now.
        const departBy = !!modeByInput.checked;
        const targetArrival = departBy ? parseTargetTime(timeField.value) : null;
        const cardOpts = targetArrival ? { targetArrival } : {};

        results.appendChild(buildSummary(result.direct, origin, dest));

        // ---- v41 — route strategies (Bus / Rail / Mixed) ------------
        // Render each strategy as its own coloured section so the user
        // sees genuinely different ways to get from A to B side-by-side.
        // Strategies with zero journeys are silently absent.
        const STRATEGY_LABELS = {
          bus:   { key: 'plannerStrategyBus',   color: 'var(--accent)' },
          rail:  { key: 'plannerStrategyRail',  color: 'var(--accent-2)' },
          mixed: { key: 'plannerStrategyMixed', color: 'var(--muted)' },
        };
        const STRATEGY_ORDER = ['bus', 'rail', 'mixed'];
        const strategies = result.strategies || {};
        STRATEGY_ORDER.forEach((s) => {
          const bucket = strategies[s];
          if (!bucket || bucket.journeys.length === 0) return;
          const meta = STRATEGY_LABELS[s];
          const sec = buildSection(t_str(meta.key), bucket.journeys.length, meta.color);
          results.appendChild(sec);
          bucket.journeys.forEach((j, i) => {
            const o = Object.assign({}, cardOpts, { strategyTag: s });
            if (i === 0) o.bestBadge = true;
            results.appendChild(buildJourneyCard(i + 1, j, o));
          });
        });

        // The journey calc has produced renderable output; remember that
        // for the depart-by mode + time picker so subsequent changes re-run.
        _hasRunOnce = true;

        const totalStrategyJourneys = STRATEGY_ORDER.reduce(
          (s, k) => s + ((strategies[k] && strategies[k].journeys.length) || 0), 0);
        if (totalStrategyJourneys === 0) {
          results.appendChild(el('div', { class: 'planner-empty' },
            el('p', {}, t_str('plannerNoResults'))));
        }

        // Save into recent.
        if (window.state && window.state.recent) {
          const entry = { kind: 'planner', from: originId, to: destId, t: Date.now() };
          window.state.recent = [entry, ...window.state.recent.filter((r) => !(r.kind === 'planner' && r.from === originId && r.to === destId))].slice(0, 20);
          try {
            localStorage.setItem('buseta.recent', JSON.stringify(window.state.recent));
          } catch {}
          refreshRecent();
        }
      } catch (err) {
        results.innerHTML = '';
        results.appendChild(el('div', { class: 'planner-empty' },
          el('p', {}, t_str('plannerError'))));
      } finally {
        submitBtn.disabled = false;
      }
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); runSearch(); });
  }

  // ---- Recent (X → Y) helpers ---------------------------------------
  function recentPlannerQueries() {
    if (!window.state || !window.state.recent) return [];
    return window.state.recent.filter((r) => r && r.kind === 'planner');
  }

  // ---- Reset caches when the index changes -------------------------
  // If the parent rebuilds state.index (e.g. on a fresh boot), drop our
  // route-stop cache so the next search re-fetches.
  function watchIndex() {
    let last = null;
    setInterval(() => {
      const cur = window.state && window.state.index;
      if (cur !== last) {
        invalidateCaches();
        last = cur;
      }
    }, 1500);
  }

  // Public API
  window.Planner = {
    search,
    renderPlanner,
    recentPlannerQueries,
    invalidateCaches,
  };

  // Best-effort: start the index watcher once the script loads.
  if (document.readyState !== 'loading') watchIndex();
  else window.addEventListener('DOMContentLoaded', watchIndex);
})();