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
  const TRANSFER_WALK_LIMIT_M = 350;   // reject transfer legs that need a walk > this
  const ORIGIN_WALK_LIMIT_M    = 1200; // walking from origin to first stop
  const DEST_WALK_LIMIT_M      = 1200;
  const ETA_MAX_MIN            = 120;  // ignore ETAs further out than this
  const CONCURRENCY            = 6;    // API concurrency cap
  const DIRECT_LIMIT           = 5;
  const ONE_TRANSFER_LIMIT     = 5;
  const TWO_TRANSFER_LIMIT     = 3;

  // ---- Module state ----------------------------------------------------
  // Per-stop route list cache. We don't pre-build the whole graph (≈600
  // routes × 30 stops = a lot of upstream calls). Instead we lazily fetch
  // route-stop lists for routes that touch origin / destination / transfer
  // candidates as we go. We also keep a `stopId → [routeKey]` reverse
  // index so subsequent 1-/2-hop searches are cheap.
  const _routeStopsCache = new Map();        // routeKey -> [{ stop, seq, lat, lng }]
  const _stopRoutesCache = new Map();        // stopId -> Set(routeKey)  (reverse index)
  let   _adjacencyCache  = new WeakMap();    // state.index -> { stops: Map(stopId -> [{ toStop, routeKey, km }]) }
  let   _indexVersion    = 0;

  function invalidateCaches() {
    _routeStopsCache.clear();
    _stopRoutesCache.clear();
    _adjacencyCache = new WeakMap();
    _indexVersion++;
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

  // ---- Index helpers --------------------------------------------------
  // Return all routeKeys whose `service` key in the global index matches.
  function allRouteKeys(idx) {
    const out = [];
    idx.routes.forEach((_v, k) => out.push(k));
    idx.ctbRoutes.forEach((_v, k) => out.push(k));
    return out;
  }

  // Fetch (and cache) the stop list of a route.
  async function getRouteStops(idx, routeKey) {
    if (_routeStopsCache.has(routeKey)) return _routeStopsCache.get(routeKey);

    const meta = idx.routes.get(routeKey) || idx.ctbRoutes.get(routeKey) || null;
    if (!meta) return null;

    let rawStops = null;
    try {
      if (meta.co === 'CTB' || meta.co === 'NWFB') {
        const resp = await fetch(`https://rt.data.gov.hk/v2/transport/citybus/route-stop/${encodeURIComponent(meta.co.toLowerCase())}/${encodeURIComponent(meta.route)}/${meta.dir === 'I' ? 'inbound' : 'outbound'}`);
        if (resp.ok) {
          const j = await resp.json();
          if (Array.isArray(j.data)) rawStops = j.data;
        }
      } else if (meta.co === 'KMB' || meta.co === 'LWB') {
        const resp = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${encodeURIComponent(meta.route)}/${meta.dir === 'I' ? 'inbound' : 'outbound'}/${encodeURIComponent(meta.service)}`);
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
    // Reverse index update.
    stops.forEach((s) => {
      if (!_stopRoutesCache.has(s.stop)) _stopRoutesCache.set(s.stop, new Set());
      _stopRoutesCache.get(s.stop).add(routeKey);
    });
    return stops;
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
  // For every route variant, ask for its stop list and check whether
  // both stops appear (in correct seq order). Score by total time.
  async function findDirect(idx, origin, dest) {
    const variants = collapseRouteVariants(idx);
    const results = await mapWithCap(variants, CONCURRENCY, async (meta) => {
      const key = `${meta.co}|${meta.route}|${meta.dir}|${meta.service}`;
      const stops = await getRouteStops(idx, key);
      if (!stops || stops.length === 0) return null;
      const oIdx = stops.findIndex((s) => s.stop === origin.stop);
      const dIdx = stops.findIndex((s) => s.stop === dest.stop);
      if (oIdx < 0 || dIdx < 0 || dIdx <= oIdx) return null;
      const rideKm = routeDistanceKm(stops, oIdx, dIdx);
      const rideMin = rideMinutes(rideKm * 1000);
      const walkInKm = stopLatLng(idx, origin.stop) && stopLatLng(idx, dest.stop)
        ? haversine(origin.lat, origin.lng, stopLatLng(idx, origin.stop).lat, stopLatLng(idx, origin.stop).lng)
        : 0;
      // We charge the walk-in only when the user is NOT physically at the
      // boarding stop. Same for walk-out at the destination.
      const walkOutM = stopLatLng(idx, origin.stop)
        ? haversine(origin.lat, origin.lng, stopLatLng(idx, origin.stop).lat, stopLatLng(idx, origin.stop).lng) * 1000
        : 0;
      const walkInM = stopLatLng(idx, dest.stop)
        ? haversine(dest.lat, dest.lng, stopLatLng(idx, dest.stop).lat, stopLatLng(idx, dest.stop).lng) * 1000
        : 0;
      if (walkOutM > ORIGIN_WALK_LIMIT_M) return null;
      if (walkInM  > DEST_WALK_LIMIT_M)   return null;
      const legs = [
        { kind: 'walk', from: 'origin', to: origin.stop, meters: walkOutM, minutes: walkMinutes(walkOutM) },
        { kind: 'ride', routeKey: key, from: origin.stop, to: dest.stop, meters: rideKm * 1000, minutes: rideMin },
        { kind: 'walk', from: dest.stop, to: 'dest', meters: walkInM, minutes: walkMinutes(walkInM) },
      ];
      return {
        kind: 'direct',
        totalMin: walkMinutes(walkOutM) + rideMin + walkMinutes(walkInM),
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

    const routesFromOrigin = routesServingStop(originStop);
    if (routesFromOrigin.length === 0) return [];

    // Fetch the stop list of every route that touches origin.
    const enriched = await mapWithCap(routesFromOrigin, CONCURRENCY, async (rk) => {
      const stops = await getRouteStops(idx, rk);
      if (!stops || stops.length === 0) return null;
      const oIdx = stops.findIndex((s) => s.stop === originStop);
      if (oIdx < 0) return null;
      return { rk, meta: idx.routes.get(rk) || idx.ctbRoutes.get(rk), stops, oIdx };
    });

    const candidates = [];
    enriched
      .filter((x) => x && x.ok && x.value)
      .forEach((x) => {
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
            // when they're the same physical stop. Approximate the
            // transfer walk via haversine otherwise.
            const aLL = (Number.isFinite(alight.lat) && Number.isFinite(alight.lng))
              ? { lat: alight.lat, lng: alight.lng } : null;
            const board2 = stops2[a2];
            const bLL = (Number.isFinite(board2.lat) && Number.isFinite(board2.lng))
              ? { lat: board2.lat, lng: board2.lng } : null;
            const xferM = (aLL && bLL) ? haversine(aLL.lat, aLL.lng, bLL.lat, bLL.lng) * 1000 : 0;
            if (xferM > TRANSFER_WALK_LIMIT_M) continue;
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
                  meters: xferM, minutes: walkMinutes(xferM),
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
      });

    // Walk-out at origin and walk-in at dest.
    const originLL = stopLatLng(idx, originStop);
    const destLL = stopLatLng(idx, destStop);
    const walkOutM = originLL ? haversine(origin.lat, origin.lng, originLL.lat, originLL.lng) * 1000 : 0;
    const walkInM = destLL ? haversine(dest.lat, dest.lng, destLL.lat, destLL.lng) * 1000 : 0;
    if (walkOutM > ORIGIN_WALK_LIMIT_M || walkInM > DEST_WALK_LIMIT_M) return [];

    const seen = new Set();
    const out = [];
    candidates.forEach((c) => {
      // The user is at origin; they need to walk *to* the boarding stop
      // of leg 1. If originStop !== board1 (which is originStop, by
      // construction) the walk is 0.
      const fullLegs = [
        { kind: 'walk', from: 'origin', to: originStop, meters: walkOutM, minutes: walkMinutes(walkOutM) },
        ...c.legs,
        { kind: 'walk', from: destStop, to: 'dest', meters: walkInM, minutes: walkMinutes(walkInM) },
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
    const routesFromOrigin = routesServingStop(originStop);
    if (routesFromOrigin.length === 0) return [];

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
      for (let i = oIdx + 1; i < Math.min(oIdx + 30, stops1.length); i++) {
        const alight1 = stops1[i];
        const r2s = routesServingStop(alight1.stop);
        for (const rk2 of r2s) {
          if (rk2 === rk1) continue;
          const stops2 = _routeStopsCache.get(rk2);
          if (!stops2) continue;
          const a2 = stops2.findIndex((s) => s.stop === alight1.stop);
          if (a2 < 0) continue;
          for (let j = a2 + 1; j < Math.min(a2 + 30, stops2.length); j++) {
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

              const xfer1M = xferMeters(alight1, stops2[a2]);
              const xfer2M = xferMeters(alight2, stops3[a3]);
              if (xfer1M > TRANSFER_WALK_LIMIT_M || xfer2M > TRANSFER_WALK_LIMIT_M) continue;
              const ride1Km = routeDistanceKm(stops1, oIdx, i);
              const ride2Km = routeDistanceKm(stops2, a2, j);
              const ride3Km = routeDistanceKm(stops3, a3, d3);

              candidates.push({
                legs: [
                    { kind: 'ride', routeKey: rk1, routeMeta: meta1,
                      from: originStop, to: alight1.stop,
                      meters: ride1Km * 1000, minutes: rideMinutes(ride1Km * 1000) },
                    { kind: 'walk', from: alight1.stop, to: stops2[a2].stop,
                      meters: xfer1M, minutes: walkMinutes(xfer1M), transfer: true },
                    { kind: 'ride', routeKey: rk2, routeMeta: meta2,
                      from: stops2[a2].stop, to: alight2.stop,
                      meters: ride2Km * 1000, minutes: rideMinutes(ride2Km * 1000) },
                    { kind: 'walk', from: alight2.stop, to: stops3[a3].stop,
                      meters: xfer2M, minutes: walkMinutes(xfer2M), transfer: true },
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
    const walkOutM = originLL ? haversine(origin.lat, origin.lng, originLL.lat, originLL.lng) * 1000 : 0;
    const walkInM = destLL ? haversine(dest.lat, dest.lng, destLL.lat, destLL.lng) * 1000 : 0;
    if (walkOutM > ORIGIN_WALK_LIMIT_M || walkInM > DEST_WALK_LIMIT_M) return [];

    const seen = new Set();
    const out = [];
    candidates.forEach((c) => {
      const fullLegs = [
        { kind: 'walk', from: 'origin', to: originStop, meters: walkOutM, minutes: walkMinutes(walkOutM) },
        ...c.legs,
        { kind: 'walk', from: destStop, to: 'dest', meters: walkInM, minutes: walkMinutes(walkInM) },
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

  // ---- Top-level search ----------------------------------------------
  async function search(originStop, destStop) {
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

    // Direct first: this prefills `_routeStopsCache` for every route so
    // the transfer searches can use the reverse index without firing
    // another batch of ~600 upstream calls.
    const direct = await findDirect(idx, origin, dest);
    const [oneTransfer, twoTransfer] = await Promise.all([
      findOneTransfer(idx, origin, dest),
      findTwoTransfer(idx, origin, dest),
    ]);

    return { direct, oneTransfer, twoTransfer, origin, dest };
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
      if (score > 0) push({ co: 'MTR', stop: code, nameTc: s.nameTc, nameEn: s.nameEn, nameSc: '', _score: score });
    });
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
        if (l.from === 'origin') label = `${t_str('plannerWalk')} → ${stopNameFromState(l.to)}`;
        else if (l.to === 'dest') label = `${stopNameFromState(l.from)} → ${t_str('plannerWalk')}`;
        else label = `${stopNameFromState(l.from)} ↔ ${stopNameFromState(l.to)}`;
      } else {
        const rm = l.routeMeta || {};
        label = `${t_str('plannerBoard')} ${rm.co || ''} ${rm.route || ''}`;
      }
      const textEl = el('div', { class: 'leg-text' }, label);
      text.appendChild(textEl);
      if (l.kind === 'walk') {
        text.appendChild(el('div', { class: 'leg-sub' }, fmtDistance(l.meters || 0)));
      } else {
        text.appendChild(el('div', { class: 'leg-sub' }, `${t_str('plannerRide')} ${fmtDistance(l.meters || 0)}`));
      }
      node.appendChild(text);
      const eta = el('span', { class: 'leg-eta' }, `${mins(l.minutes)} ${t_str('minShort')}`);
      node.appendChild(eta);
      wrap.appendChild(node);
    });
    return wrap;
  }

  function stopNameFromState(stopId) {
    const idx = window.state && window.state.index;
    if (!idx) return stopId;
    return stopName(idx, stopId);
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
      routes.appendChild(el('span', { class: `planner-chip co-${co}` },
        rm.co === 'GMB' ? (rm.route || '') : (rm.route || '')));
      if (i < rideLegs.length - 1) routes.appendChild(el('span', { class: 'planner-card-arrow' }, '→'));
    });
    head.appendChild(routes);
    if (opts.bestBadge) {
      head.appendChild(el('span', { class: 'planner-chip', style: 'background: var(--accent); color:#fff; margin-left: 4px;' },
        t_str('plannerBest')));
    }
    main.appendChild(head);

    // Summary meta row (total walk, total ride, transfer count).
    const totalWalkM = journey.legs.filter((l) => l.kind === 'walk').reduce((s, l) => s + (l.meters || 0), 0);
    const totalRideM = journey.legs.filter((l) => l.kind === 'ride').reduce((s, l) => s + (l.meters || 0), 0);
    const transfers = rideLegs.length - 1;
    const meta = el('div', { class: 'planner-card-meta' });
    meta.appendChild(el('span', { class: 'item' }, `${t_str('plannerWalk')} `, el('strong', {}, fmtDistance(totalWalkM))));
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
    const now = new Date();
    const eta = new Date(now.getTime() + journey.totalMin * 60000);
    const hh = String(eta.getHours()).padStart(2, '0');
    const mm = String(eta.getMinutes()).padStart(2, '0');
    timeBox.appendChild(el('span', { class: 'small' },
      `${t_str('plannerArrive')} ${hh}:${mm}`));
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
        const a = originField.value, b = destField.value;
        originField.value = b; destField.value = a;
        const tmp = _selected.origin; _selected.origin = _selected.dest; _selected.dest = tmp;
        renderSuggests(originField, originSuggest, _selected.origin);
        renderSuggests(destField, destSuggest, _selected.dest);
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
          originField.value = fromName;
          destField.value = toName;
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

    // ---- selection state ----
    const _selected = { origin: null, dest: null };

    // ---- autocomplete ----
    function attachAutocomplete(field, suggest, side) {
      let active = -1;
      function close() { suggest.classList.remove('is-open'); suggest.innerHTML = ''; active = -1; }
      function render(matches) {
        suggest.innerHTML = '';
        if (!matches || matches.length === 0) { close(); return; }
        matches.forEach((m, idx) => {
          const row = el('div', {
            class: 'planner-suggest-row' + (idx === active ? ' is-active' : ''),
            dataset: { idx: String(idx) },
          });
          row.appendChild(el('div', {},
            el('div', { class: 'row-title' }, nameFor(m) || m.stop),
            el('div', { class: 'row-sub' }, m.stop + (m.co && m.co !== 'STOP' ? ` · ${m.co}` : '')),
          ));
          row.addEventListener('mousedown', (e) => {
            e.preventDefault();
            _selected[side] = m.stop;
            field.value = nameFor(m) || m.stop;
            close();
          });
          suggest.appendChild(row);
        });
        suggest.classList.add('is-open');
      }
      field.addEventListener('input', () => {
        _selected[side] = null;
        const q = field.value.trim();
        if (!q) { close(); return; }
        render(searchStopsLite(q));
        active = -1;
      });
      field.addEventListener('focus', () => {
        const q = field.value.trim();
        if (q && !_selected[side]) render(searchStopsLite(q));
      });
      field.addEventListener('blur', () => setTimeout(close, 150));
      field.addEventListener('keydown', (e) => {
        const rows = Array.from(suggest.children);
        if (e.key === 'ArrowDown') { active = Math.min(active + 1, rows.length - 1); render(searchStopsLite(field.value.trim())); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); render(searchStopsLite(field.value.trim())); e.preventDefault(); }
        else if (e.key === 'Enter' && rows.length > 0 && active >= 0) {
          const idx = active; _selected[side] = null; // reset; row click will set it
          rows[idx].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          e.preventDefault();
        }
      });
      function renderSuggests() {
        const q = field.value.trim();
        if (q && !_selected[side]) render(searchStopsLite(q));
      }
      return renderSuggests;
    }
    const renderSuggests = (field, suggest, side) => attachAutocomplete(field, suggest, side);

    // Pre-fill from the recent planner entry (if any) when the view first
    // opens. The user can still type a new query.
    const lastPlanner = (window.state && window.state.recent || []).find((r) => r.kind === 'planner');
    if (lastPlanner) {
      const idx = window.state && window.state.index;
      originField.value = idx ? stopName(idx, lastPlanner.from) : lastPlanner.from;
      destField.value = idx ? stopName(idx, lastPlanner.to) : lastPlanner.to;
      _selected.origin = lastPlanner.from;
      _selected.dest = lastPlanner.to;
    }

    // ---- search ----
    async function runSearch() {
      // Resolve origin / dest. Either pick from autocomplete or do a fresh search.
      let originId = _selected.origin;
      let destId   = _selected.dest;
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

        results.appendChild(buildSummary(result.direct, origin, dest));

        // ---- direct ----
        if (result.direct.length > 0) {
          const sec = buildSection(t_str('plannerDirect'), result.direct.length, 'var(--accent)');
          results.appendChild(sec);
          result.direct.forEach((j, i) => {
            results.appendChild(buildJourneyCard(i + 1, j, { bestBadge: i === 0 }));
          });
        }

        // ---- 1-transfer ----
        if (result.oneTransfer.length > 0) {
          const sec = buildSection(t_str('planner1Hop'), result.oneTransfer.length, 'var(--accent-2)');
          results.appendChild(sec);
          result.oneTransfer.forEach((j, i) => {
            results.appendChild(buildJourneyCard(i + 1, j, {}));
          });
        }

        // ---- 2-transfer ----
        if (result.twoTransfer.length > 0) {
          const sec = buildSection(t_str('planner2Hop'), result.twoTransfer.length, 'var(--muted)');
          results.appendChild(sec);
          result.twoTransfer.forEach((j, i) => {
            results.appendChild(buildJourneyCard(i + 1, j, {}));
          });
        }

        if (result.direct.length === 0 && result.oneTransfer.length === 0 && result.twoTransfer.length === 0) {
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