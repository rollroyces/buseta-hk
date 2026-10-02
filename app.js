/* ============================================================
   BusETA HK · 巴士到站 — application logic
   ============================================================
   Public data sources:
     KMB / LWB    → https://data.etabus.gov.hk/v1/transport/kmb/
     Citybus      → https://rt.data.gov.hk/v2/transport/citybus/
     Green Minibus (GMB, 專線小巴) → https://data.etagmb.gov.hk/
     MTR heavy rail  → https://rt.data.gov.hk/v1/transport/mtr/
     MTR Light Rail  → https://rt.data.gov.hk/v1/transport/mtr/lrt/
     MTR line/station list → https://opendata.mtr.com.hk/data/
     Stop coordinates (GMB / NLB / MTR) → third-party curated
       dataset by hk-bus (https://data.hkbus.app/), packaged at
       /assets/hk-stops.json (CC0-style compilation of TD sources).
   ============================================================ */

(() => {
  'use strict';

  // ------------------------------------------------------------------
  // i18n
  // ------------------------------------------------------------------
  const STRINGS = {
    'zh-Hant': {
      brandSub: '香港巴士',
      tagline: '即時到站',
      loading: '載入緊資料…',
      navHome: '主頁',
      navSearch: '搜尋',
      langOther: 'English',
      savedRoutes: '收藏路線',
      savedStops: '收藏車站',
      recentSearches: '最近查過',
      operatorsTitle: '支援交通工具',
      operatorsNote: '獨立第三方應用。資料由各營辦商透過運輸署公開數據提供。',
      emptyRoutes: '未有收藏路線。',
      emptyStops: '未有收藏車站。',
      emptyRecent: '未有最近查過嘅路線。',
      footerAttribution: '資料來源：運輸署資料一線通。到站時間來自九巴、龍運、城巴、專線小巴及港鐵（包括輕鐵）；車費來自公共交通路線及收費資料。預計時間約每分鐘更新，只供參考。',
      searchPlaceholder: '路線、地點、車站或港鐵站',
      filterAll: '全部',
      filterKMB: '九巴',
      filterLWB: '龍運',
      filterCTB: '城巴',
      filterGMB: '小巴',
      filterMTR: '港鐵',
      nearbyRoutes: '附近路線',
      nearbyStops: '附近車站',
      nearbyStations: '附近港鐵站',
      locating: '定位中…',
      locationDenied: '定位被拒絕，未能取得附近路線。',
      locationUnavailable: '未能取得位置，未能提供附近路線。',
      noResults: '搵唔到相關嘅路線、車站或港鐵站。',
      back: '返回',
      route: '路線',
      stop: '車站',
      to: '→',
      inbound: '入站',
      outbound: '出站',
      dirUp: '上行',
      dirDown: '下行',
      save: '收藏',
      saved: '已收藏',
      unsave: '取消收藏',
      minShort: '分',
      arriving: '即將到站',
      scheduled: '原定班次',
      lastBus: '尾班車',
      lastTrain: '尾班車',
      noEta: '暫無到站時間',
      etaCount: (n) => `仲有 ${n} 班`,
      errorTitle: '搵唔到嗰頁',
      errorBody: '你跟蹤嘅連結可能已經過期，或者資料未能成功載入。',
      retry: '再試一次',
      showingStop: (n) => `全線 ${n} 站`,
      enName: '英文名',
      kmb: '九巴',
      lwb: '龍運',
      ctb: '城巴',
      nwfb: '新巴',
      gmb: '專線小巴',
      mtr: '港鐵',
      lrt: '輕鐵',
      routeNotFound: '搵唔到呢條路線。',
      stopNotFound: '搵唔到呢個車站。',
      noNearbyRoutes: '附近範圍未有常見路線。',
      noNearbyStops: '附近範圍未有常見車站。',
      noNearbyStations: '附近範圍未有港鐵站。',
      searchHint: '輸入路線編號、車站名或港鐵站',
      noFavHint: '搜尋後可以加入收藏，方便日後對陣查閱。',
      clearRecent: '清除記錄',
      cleared: '已清除',
      toStop: '去呢個車站',
      toRoute: '睇路線詳情',
      line: '綫路',
      station: '車站',
      platform: '月台',
      trains: '班列車',
      allLines: '全部綫路',
      selectStation: '揾該站',
      loadingRoutes: '搵緊小巴路線…',
      gmbProgress: (done, total) => `已載入 ${done}/${total} 條小巴路線`,
      fetchFailed: '載入唔到，撳一撳重試',
      openInMaps: '喺 Google Maps 開啟',
      mapHeader: '地圖',
      settingsTitle: '設定',
      gmapsKeyLabel: 'Google Maps API key',
      gmapsKeyHint: '用 Google Maps Embed API 嘅 key（網站 HTTP referrer 已限制）。留空就會用連結到 Google Maps 而唔係內嵌地圖。',
      gmapsKeySave: '儲存',
      gmapsKeySaved: '已儲存',
      gmapsKeyCleared: '已清除',
      clearKey: '清除',
      fare: '車費',
      updatedJust: '剛剛更新',
      updatedMeta: '到站時間每分鐘更新',
      refresh: '更新',
    },
    'en': {
      brandSub: 'Hong Kong Bus',
      tagline: 'Real-time arrivals',
      loading: 'Loading data…',
      navHome: 'Home',
      navSearch: 'Search',
      langOther: '繁體中文',
      savedRoutes: 'Saved routes',
      savedStops: 'Saved stops',
      recentSearches: 'Recent searches',
      operatorsTitle: 'Supported transit',
      operatorsNote: 'Independent third-party app. Data published via Transport Department open data.',
      emptyRoutes: 'No saved routes yet.',
      emptyStops: 'No saved stops yet.',
      emptyRecent: 'No recent searches.',
      footerAttribution: 'Data source: Transport Department Data One. Arrivals from KMB, LWB, Citybus, Green Minibus and MTR (including Light Rail); fares from public transport data. ETAs refresh about every minute, for reference only.',
      searchPlaceholder: 'Route, place, stop or MTR station',
      filterAll: 'All',
      filterKMB: 'KMB',
      filterLWB: 'LWB',
      filterCTB: 'Citybus',
      filterGMB: 'Minibus',
      filterMTR: 'MTR',
      nearbyRoutes: 'Nearby routes',
      nearbyStops: 'Nearby stops',
      nearbyStations: 'Nearby stations',
      locating: 'Locating…',
      locationDenied: 'Location denied — nearby routes unavailable.',
      locationUnavailable: 'Location unavailable — nearby routes unavailable.',
      noResults: 'No matching routes, stops or stations.',
      back: 'Back',
      route: 'Route',
      stop: 'Stop',
      to: '→',
      inbound: 'Inbound',
      outbound: 'Outbound',
      dirUp: 'Up',
      dirDown: 'Down',
      save: 'Save',
      saved: 'Saved',
      unsave: 'Unsave',
      minShort: 'min',
      arriving: 'Arriving',
      scheduled: 'Scheduled',
      lastBus: 'Last bus',
      lastTrain: 'Last train',
      noEta: 'No ETA',
      etaCount: (n) => `${n} more`,
      errorTitle: 'Page not found',
      errorBody: 'The link may be out of date, or the data could not load.',
      retry: 'Try again',
      showingStop: (n) => `${n} stops`,
      enName: 'English',
      kmb: 'KMB',
      lwb: 'LWB',
      ctb: 'Citybus',
      nwfb: 'NWFB',
      gmb: 'Minibus',
      mtr: 'MTR',
      lrt: 'Light Rail',
      routeNotFound: 'Route not found.',
      stopNotFound: 'Stop not found.',
      noNearbyRoutes: 'No nearby routes found.',
      noNearbyStops: 'No nearby stops found.',
      noNearbyStations: 'No nearby MTR stations.',
      searchHint: 'Enter route number, stop name or station',
      noFavHint: 'Search and tap the star to save routes, stops and stations for quick access.',
      clearRecent: 'Clear',
      cleared: 'Cleared',
      toStop: 'Open stop',
      toRoute: 'Open route',
      line: 'Line',
      station: 'Station',
      platform: 'Platform',
      trains: 'trains',
      allLines: 'All lines',
      selectStation: 'Open station',
      loadingRoutes: 'Loading minibus routes…',
      gmbProgress: (done, total) => `Loaded ${done}/${total} minibus routes`,
      fetchFailed: 'Failed to load — tap to retry',
      openInMaps: 'Open in Google Maps',
      mapHeader: 'Map',
      settingsTitle: 'Settings',
      gmapsKeyLabel: 'Google Maps API key',
      gmapsKeyHint: 'Use a Google Maps Embed API key (with your site URL restricted as HTTP referrer). Leave blank to fall back to opening Google Maps in a new tab.',
      gmapsKeySave: 'Save',
      gmapsKeySaved: 'Saved',
      gmapsKeyCleared: 'Cleared',
      clearKey: 'Clear',
      fare: 'Fare',
      updatedJust: 'Just updated',
      updatedMeta: 'Live arrivals refresh every minute',
      refresh: 'Refresh',
    },
  };

  // ------------------------------------------------------------------
  // Constants
  // ------------------------------------------------------------------
  const API = {
    KMB: 'https://data.etabus.gov.hk/v1/transport/kmb',
    CITYBUS: 'https://rt.data.gov.hk/v2/transport/citybus',
    GMB: 'https://data.etagmb.gov.hk',
    MTR: 'https://rt.data.gov.hk/v1/transport/mtr',
    MTR_STATIC: 'https://opendata.mtr.com.hk/data',
    HK_STOPS: 'assets/hk-stops.json',
    MTR_STOPS: 'assets/mtr-stops.json',
    MTR_LINES: 'assets/mtr-lines.json',
    LRT_ROUTES: 'assets/lrt-routes.json',
  };

  const STORAGE_KEYS = {
    LANG: 'buseta.lang',
    ROUTES: 'buseta.saved.routes',
    STOPS: 'buseta.saved.stops',
    RECENT: 'buseta.recent',
    INDEX: 'buseta.index',
    INDEX_TS: 'buseta.index.ts',
    INDEX_VER: 'buseta.index.ver',
    GMB_LIST: 'buseta.gmb.list',
    GMB_LIST_TS: 'buseta.gmb.list.ts',
    GMB_PROGRESS: 'buseta.gmb.progress',
    GMAPS_KEY: 'buseta.gmapsKey',
    CONFIG: 'assets/config.json',
    META: 'buseta.meta',
  };

  // Bump this whenever the on-disk shape of the index changes, so old
  // cached snapshots get discarded and rebuilt against the live APIs.
  const INDEX_SCHEMA_VERSION = 3;

  const REFRESH_INTERVAL_MS = 60_000;
  const INDEX_MAX_AGE_MS = 12 * 60 * 60 * 1000;
  const GMB_LIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const GMB_INDEX_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const state = {
    lang: 'zh-Hant',
    index: null,
    savedRoutes: [],
    savedStops: [],
    recent: [],
    location: null,
    locationStatus: 'idle',
    refreshTimer: null,
    lastSearchQ: '',
    filter: 'ALL',
    detailRoute: null,
    detailStop: null,
    gmapsKey: '',
    gmapsConfigLoaded: false,
  };

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const el = (tag, attrs = {}, ...rest) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'style') node.setAttribute('style', v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of rest.flat()) {
      if (c == null || c === false) continue;
      node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  };

  const t_str = (key, ...args) => {
    const s = STRINGS[state.lang][key];
    return typeof s === 'function' ? s(...args) : (s ?? key);
  };

  const debounce = (fn, wait) => {
    let id = null;
    return (...args) => {
      clearTimeout(id);
      id = setTimeout(() => fn(...args), wait);
    };
  };

  const pickFirst = (a, b) => (a && String(a).trim()) || (b && String(b).trim()) || '';

  const makeRouteKey = (co, route, dir, service) => `${co}|${route}|${dir}|${service}`;
  const sameRoute = (a, b) =>
    a.co === b.co && a.route === b.route && a.dir === b.dir && a.service === b.service;
  const sameStop = (a, b) =>
    String(a.stop) === String(b.stop) && (a.co || 'STOP') === (b.co || 'STOP');

  function classifyKmbOp(route, origTc, destTc) {
    const r = String(route || '').toUpperCase().trim();
    if (/^[AEN]/.test(r)) return 'LWB';
    if (/^R\d/.test(r)) return 'LWB';
    if (/^S\d/.test(r)) return 'LWB';
    if (/^T\d/.test(r)) return 'LWB';
    if (/^X\d/.test(r) && /(機場|博覽|東涌|昂坪|港珠澳|口岸)/.test((origTc || '') + (destTc || ''))) return 'LWB';
    return 'KMB';
  }

  function opCoKey(co) {
    if (co === 'KMB') return 'kmb';
    if (co === 'LWB') return 'lwb';
    if (co === 'CTB') return 'ctb';
    if (co === 'NWFB') return 'nwfb';
    if (co === 'GMB') return 'gmb';
    if (co === 'MTR') return 'mtr';
    if (co === 'LRT') return 'lrt';
    return co;
  }

  // ------------------------------------------------------------------
  // Persistence
  // ------------------------------------------------------------------
  const storage = {
    get(key, fallback) {
      try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
      catch { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  };

  function loadState() {
    state.lang = storage.get(STORAGE_KEYS.LANG, 'zh-Hant');
    state.savedRoutes = storage.get(STORAGE_KEYS.ROUTES, []);
    state.savedStops = storage.get(STORAGE_KEYS.STOPS, []);
    state.recent = storage.get(STORAGE_KEYS.RECENT, []);
  }
  function persist() {
    storage.set(STORAGE_KEYS.LANG, state.lang);
    storage.set(STORAGE_KEYS.ROUTES, state.savedRoutes);
    storage.set(STORAGE_KEYS.STOPS, state.savedStops);
    storage.set(STORAGE_KEYS.RECENT, state.recent);
  }

  // ------------------------------------------------------------------
  // Index
  //   state.index.routes  — Map of bus routes (KMB / LWB / CTB / NWFB / GMB)
  //   state.index.stops   — Map of bus stops (KMB / CTB / GMB, MTR/LRT too)
  //   state.index.mtr     — Map of MTR stations
  //   state.index.lrt     — Map of LRT routes and stops
  //   state.index.gmbList — Array of {region, code} that we have route IDs for
  // ------------------------------------------------------------------
  function rehydrateIndex(raw) {
    return {
      routes: new Map(raw.routes || []),
      stops: new Map(raw.stops || []),
      ctbRoutes: new Map(raw.ctbRoutes || []),
      mtr: new Map(raw.mtr || []),
      lrt: {
        routes: new Map((raw.lrt && raw.lrt.routes) || []),
        stops: new Map((raw.lrt && raw.lrt.stops) || []),
        platforms: new Map((raw.lrt && raw.lrt.platforms) || []),
      },
    };
  }
  function dehydrateIndex(idx) {
    return {
      routes: Array.from(idx.routes.entries()),
      stops: Array.from(idx.stops.entries()),
      ctbRoutes: Array.from(idx.ctbRoutes.entries()),
      mtr: Array.from(idx.mtr.entries()),
      lrt: {
        routes: Array.from(idx.lrt.routes.entries()),
        stops: Array.from(idx.lrt.stops.entries()),
        platforms: Array.from(idx.lrt.platforms.entries()),
      },
    };
  }

  async function loadIndex() {
    if (state.index) return state.index;
    const cached = storage.get(STORAGE_KEYS.INDEX, null);
    const ts = storage.get(STORAGE_KEYS.INDEX_TS, 0);
    const ver = storage.get(STORAGE_KEYS.INDEX_VER, 0);
    if (cached && ver === INDEX_SCHEMA_VERSION && Date.now() - ts < INDEX_MAX_AGE_MS) {
      state.index = rehydrateIndex(cached);
      // Background refresh (don't await)
      buildIndex().catch(() => {});
      return state.index;
    }
    return buildIndex();
  }

  async function buildIndex() {
    const [kmbRoutes, kmbStops, ctbRoutes, mtrLines, lrtRoutes, hkStops, mtrStops] = await Promise.all([
      fetchJSON(`${API.KMB}/route/`).catch(() => null),
      fetchJSON(`${API.KMB}/stop/`).catch(() => null),
      fetchJSON(`${API.CITYBUS}/route/ctb`).catch(() => null),
      fetchJSON(API.MTR_LINES).catch(() => null),
      fetchJSON(API.LRT_ROUTES).catch(() => null),
      fetchJSON(API.HK_STOPS).catch(() => null),
      fetchJSON(API.MTR_STOPS).catch(() => null),
    ]);

    const routes = new Map();
    const stops = new Map();
    const ctb = new Map();
    const mtr = new Map();
    const lrt = { routes: new Map(), stops: new Map(), platforms: new Map() };

    // ---- KMB / LWB ----
    if (kmbRoutes && Array.isArray(kmbRoutes.data)) {
      for (const r of kmbRoutes.data) {
        const key = makeRouteKey('KMB', r.route, r.bound, r.service_type);
        const op = classifyKmbOp(r.route, r.orig_tc || '', r.dest_tc || '');
        routes.set(key, {
          co: op, route: r.route, dir: r.bound, service: r.service_type,
          origTc: r.orig_tc, origEn: r.orig_en,
          destTc: r.dest_tc, destEn: r.dest_en,
        });
      }
    }
    if (kmbStops && Array.isArray(kmbStops.data)) {
      for (const s of kmbStops.data) {
        stops.set(s.stop, {
          stop: s.stop, nameTc: s.name_tc, nameEn: s.name_en,
          lat: parseFloat(s.lat), lng: parseFloat(s.long),
        });
      }
    }

    // ---- Citybus (CTB + NWFB) ----
    if (ctbRoutes && Array.isArray(ctbRoutes.data)) {
      for (const r of ctbRoutes.data) {
        const op = r.co === 'NWFB' ? 'NWFB' : 'CTB';
        const key = makeRouteKey(op, r.route, 'O', '1');
        ctb.set(key, {
          co: op, route: r.route, dir: 'O', service: '1',
          origTc: r.orig_tc, origEn: r.orig_en,
          destTc: r.dest_tc, destEn: r.dest_en,
        });
      }
    }

    // ---- Merge in curated stop coordinates (fills GMB stops + MTR stations
    //      + any stops that were missing WKT lat/lng) ----
    if (hkStops && typeof hkStops === 'object') {
      for (const [id, info] of Object.entries(hkStops)) {
        if (!info) continue;
        const lat = Number(info.lat);
        const lng = Number(info.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        // KMB stops already have lat/lng from the official API; only fill in
        // if missing. Other operators (GMB, MTR, NLB) only get coords here.
        const existing = stops.get(id);
        if (existing) {
          if (!Number.isFinite(existing.lat) || !Number.isFinite(existing.lng)) {
            existing.lat = lat;
            existing.lng = lng;
          }
        } else {
          stops.set(id, {
            stop: id,
            nameTc: info.zh || '',
            nameEn: info.en || '',
            lat, lng,
          });
        }
      }
    }

    // ---- MTR heavy rail (parse line_stations grid → StationIndex → Join with mtr-stops.json coords) ----
    if (mtrLines && Array.isArray(mtrLines)) {
      const lineNames = {
        AEL: { zh: '機場快綫', en: 'Airport Express' },
        TCL: { zh: '東涌綫',   en: 'Tung Chung Line' },
        TKL: { zh: '將軍澳綫', en: 'Tseung Kwan O Line' },
        TML: { zh: '屯馬綫',   en: 'Tuen Ma Line' },
        EAL: { zh: '東鐵綫',   en: 'East Rail Line' },
        SIL: { zh: '南港島綫', en: 'South Island Line' },
        TWL: { zh: '荃灣綫',   en: 'Tsuen Wan Line' },
        ISL: { zh: '港島綫',   en: 'Island Line' },
        KTL: { zh: '觀塘綫',   en: 'Kwun Tong Line' },
        DRL: { zh: '迪士尼綫', en: 'Disneyland Resort Line' },
      };
      const seenStations = new Map();
      for (const row of mtrLines) {
        const lineCode = row.line, direction = row.dir, stationCode = row.station;
        if (!lineCode || !stationCode) continue;
        const lineLabel = lineNames[lineCode] || { zh: lineCode, en: lineCode };

        const routeKey = `MTR|${lineCode}`;
        if (!mtr.has(routeKey)) {
          mtr.set(routeKey, {
            co: 'MTR', route: lineCode, dir: '', service: '',
            origTc: lineLabel.zh, origEn: lineLabel.en,
            destTc: lineLabel.zh, destEn: lineLabel.en,
            _isLine: true, _directions: new Set(),
          });
        }
        mtr.get(routeKey)._directions.add(direction);

        const coordInfo = (mtrStops && mtrStops[stationCode]) || null;
        const lat = coordInfo ? Number(coordInfo.lat) : NaN;
        const lng = coordInfo ? Number(coordInfo.lng) : NaN;
        if (!seenStations.has(stationCode)) {
          seenStations.set(stationCode, {
            co: 'MTR', stop: stationCode,
            nameTc: row.zh, nameEn: row.en,
            lat: Number.isFinite(lat) ? lat : null,
            lng: Number.isFinite(lng) ? lng : null,
            lines: [lineCode], _dirs: [direction], _seq: row.seq || 0,
          });
        } else {
          const st = seenStations.get(stationCode);
          if (!st.lines.includes(lineCode)) st.lines.push(lineCode);
          if (!st._dirs.includes(direction)) st._dirs.push(direction);
          if ((!Number.isFinite(st.lat) || st.lat == null) && Number.isFinite(lat)) {
            st.lat = lat; st.lng = lng;
          }
        }
      }
      for (const st of seenStations.values()) mtr.set(st.stop, st);
    }

    // ---- Light Rail (parse routes_and_stops from JSON asset) ----
    if (lrtRoutes && Array.isArray(lrtRoutes)) {
      const routeMeta = new Map();
      const stopMeta = new Map();
      for (const row of lrtRoutes) {
        const routeNo = row.route, dir = row.dir, stopCode = row.stop;
        if (!routeNo || !stopCode) continue;
        const routeKey = `LRT|${routeNo}`;
        if (!routeMeta.has(routeKey)) {
          routeMeta.set(routeKey, { co: 'LRT', route: routeNo, dir: '', service: '', origTc: '', origEn: '', destTc: '', destEn: '', _dirs: new Set(), _stops: [] });
        }
        const meta = routeMeta.get(routeKey);
        meta._dirs.add(dir);
        meta._stops.push({ stop: stopCode, dir, seq: row.seq || 0, id: row.id });

        if (!stopMeta.has(stopCode)) {
          stopMeta.set(stopCode, { co: 'LRT', stop: stopCode, nameTc: row.zh, nameEn: row.en, id: row.id, _routes: new Set() });
        }
        stopMeta.get(stopCode)._routes.add(routeNo);
      }
      for (const [key, meta] of routeMeta) {
        const dirs = Array.from(meta._dirs);
        const dir = dirs.includes('1') ? '1' : dirs[0];
        const stopsForDir = meta._stops.filter((s) => s.dir === dir).sort((a, b) => a.seq - b.seq);
        if (stopsForDir.length > 0) {
          meta.dir = dir;
          meta.service = stopsForDir[0].stop;
          meta.origTc = stopMeta.get(stopsForDir[0].stop).nameTc;
          meta.origEn = stopMeta.get(stopsForDir[0].stop).nameEn;
          meta.destTc = stopMeta.get(stopsForDir[stopsForDir.length - 1].stop).nameTc;
          meta.destEn = stopMeta.get(stopsForDir[stopsForDir.length - 1].stop).nameEn;
          meta._stops = stopsForDir;
        }
        delete meta._dirs;
        lrt.routes.set(key, meta);
      }
      for (const st of stopMeta.values()) {
        st._routes = Array.from(st._routes);
        lrt.stops.set(st.stop, st);
      }
    }

    state.index = { routes, stops, ctbRoutes: ctb, mtr, lrt };
    storage.set(STORAGE_KEYS.INDEX, dehydrateIndex(state.index));
    storage.set(STORAGE_KEYS.INDEX_TS, Date.now());
    storage.set(STORAGE_KEYS.INDEX_VER, INDEX_SCHEMA_VERSION);

    // Kick off GMB route list build in the background.
    ensureGmbList().catch(() => {});

    return state.index;
  }

  // Light CSV parser for the MTR/LRT files: handles quoted fields with commas.
  function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQuote = false;
        } else cur += ch;
      } else if (ch === '"') inQuote = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }

  // ------------------------------------------------------------------
  // Network
  // ------------------------------------------------------------------
  async function fetchJSON(url, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  async function fetchText(url, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  const fetchKmbRouteStop = (route, dir, service) =>
    fetchJSON(`${API.KMB}/route-stop/${encodeURIComponent(route)}/${dir === 'I' ? 'inbound' : 'outbound'}/${encodeURIComponent(service)}`);
  const fetchKmbStop = (stopId) =>
    fetchJSON(`${API.KMB}/stop/${encodeURIComponent(stopId)}`);
  const fetchKmbStopEta = (stopId) =>
    fetchJSON(`${API.KMB}/stop-eta/${encodeURIComponent(stopId)}`);

  // GMB (Green Minibus / 專線小巴)
  const fetchGmbRoute = (region, code) =>
    fetchJSON(`${API.GMB}/route/${encodeURIComponent(region)}/${encodeURIComponent(code)}`);
  const fetchGmbRouteStops = (routeId, routeSeq) =>
    fetchJSON(`${API.GMB}/route-stop/${encodeURIComponent(String(routeId))}/${encodeURIComponent(String(routeSeq))}`);
  const fetchGmbStopEta = (routeId, routeSeq, stopSeq) =>
    fetchJSON(`${API.GMB}/eta/route-stop/${encodeURIComponent(String(routeId))}/${encodeURIComponent(String(routeSeq))}/${encodeURIComponent(String(stopSeq))}`);
  const fetchGmbStopRoutes = (stopId) =>
    fetchJSON(`${API.GMB}/stop-route/${encodeURIComponent(String(stopId))}`);
  const fetchGmbStopCoord = (stopId) =>
    fetchJSON(`${API.GMB}/stop/${encodeURIComponent(String(stopId))}`);

  // MTR (heavy rail) — line/station codes are 3-letter strings.
  const fetchMtrSchedule = (line, station) =>
    fetchJSON(`${API.MTR}/getSchedule.php?line=${encodeURIComponent(line)}&sta=${encodeURIComponent(station)}&lang=tc`);

  // Light Rail — station_id is 3-digit numeric string (e.g. "001").
  const fetchLrtSchedule = (stationId) =>
    fetchJSON(`${API.MTR}/lrt/getSchedule?station_id=${encodeURIComponent(String(stationId))}`);

  // Bounded-concurrency fetcher: runs up to `limit` fetches in parallel.
  async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        try { results[i] = await fn(items[i], i); }
        catch (e) { results[i] = { __error: e }; }
      }
    });
    await Promise.all(workers);
    return results;
  }

  // ------------------------------------------------------------------
  // Google Maps per-stop section.
  //   Mirrors the justarrived.grok.me design:
  //     – Live Google Maps embed iframe using the no-key "output=embed"
  //       URL pattern (works without any API key).
  //     – Card-style frame with rounded corners and shadow.
  //     – Red pin-icon "Open in Google Maps" link underneath.
  //     – Section sits at the bottom of the stop / station view.
  // ------------------------------------------------------------------
  function loadGmapsConfig() {
    if (state.gmapsConfigLoaded) return Promise.resolve(state.gmapsKey);
    state.gmapsConfigLoaded = true;
    return fetchJSON(API.CONFIG).then((cfg) => {
      if (cfg && typeof cfg.gmapsKey === 'string') {
        state.gmapsKey = cfg.gmapsKey.trim();
      }
    }).catch(() => {});
  }
  function getGmapsKey() {
    const userKey = storage.get(STORAGE_KEYS.GMAPS_KEY, '');
    return (userKey && String(userKey).trim()) || state.gmapsKey || '';
  }

  function mapsQuery(lat, lng) {
    return `${lat.toFixed(6)},${lng.toFixed(6)}`;
  }

  // Render the per-stop map section. Pass lat/lng (numbers) and the stop's
  // human-readable name. Returns an empty Node if no coordinates are
  // available so callers can safely append it.
  function renderStopMap(lat, lng, name) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return el('div');
    const section = el('section', { class: 'stop-map', 'aria-label': t_str('mapHeader') });
    const frame = el('div', { class: 'stop-map-frame' });

    // Embed Google Maps. The legacy "output=embed" URL renders the standard
    // Maps iframe (controls, attribution, satellite thumbnail) without any
    // API key. The optional ?key= enables a slightly nicer embed when the
    // site owner has configured one.
    const q = mapsQuery(lat, lng);
    const params = new URLSearchParams({ q, z: '17', output: 'embed' });
    const key = getGmapsKey();
    if (key) params.set('key', key);
    const iframe = el('iframe', {
      title: `${t_str('mapHeader')} · ${name}`,
      loading: 'lazy',
      referrerpolicy: 'no-referrer-when-downgrade',
      src: `https://maps.google.com/maps?${params.toString()}`,
      style: 'border:0;',
    });
    frame.appendChild(iframe);

    const link = el('a', {
      class: 'stop-map-link',
      href: `https://www.google.com/maps?q=${q}`,
      target: '_blank',
      rel: 'noopener',
    });
    link.appendChild(mapPinIconSVG());
    const linkText = el('span', {}, t_str('openInMaps'));
    link.appendChild(linkText);
    section.appendChild(frame);
    section.appendChild(link);
    return section;
  }

  // Small filled "pin" icon used next to the "Open in Google Maps" text.
  function mapPinIconSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('stop-map-link-icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 2c-4.418 0-8 3.537-8 7.9 0 5.7 7.1 11.6 7.4 11.85a1 1 0 0 0 1.2 0c.3-.25 7.4-6.15 7.4-11.85 0-4.363-3.582-7.9-8-7.9zm0 10.9a3 3 0 1 1 0-6 3 3 0 0 1 0 6z');
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    return svg;
  }

  // ------------------------------------------------------------------
  // GMB route list (progressive background build)
  // ------------------------------------------------------------------
  function loadGmbList() {
    try {
      const raw = storage.get(STORAGE_KEYS.GMB_LIST, null);
      const ts = storage.get(STORAGE_KEYS.GMB_LIST_TS, 0);
      if (!raw || Date.now() - ts > GMB_LIST_MAX_AGE_MS) return null;
      return raw;
    } catch { return null; }
  }

  async function ensureGmbList() {
    if (state.gmbListPromise) return state.gmbListPromise;
    let list = loadGmbList();
    if (list && list.length) {
      state.gmbList = list;
      // Ensure we have route IDs for each — fetch missing ones in background.
      primeGmbRoutes(list).catch(() => {});
      return list;
    }
    state.gmbListPromise = (async () => {
      try {
        const resp = await fetchJSON(`${API.GMB}/route`);
        const raw = (resp && resp.data && resp.data.routes) || {};
        const list = [];
        for (const [region, codes] of Object.entries(raw)) {
          for (const code of codes) list.push({ region, code });
        }
        storage.set(STORAGE_KEYS.GMB_LIST, list);
        storage.set(STORAGE_KEYS.GMB_LIST_TS, Date.now());
        state.gmbList = list;
        // Kick off route ID enrichment in the background.
        primeGmbRoutes(list).catch(() => {});
        return list;
      } catch (err) {
        console.warn('GMB list fetch failed', err);
        return [];
      } finally {
        state.gmbListPromise = null;
      }
    })();
    return state.gmbListPromise;
  }

  // Enrich GMB route index lazily. Pulls each /route/{region}/{code} and
  // caches into the main index so search picks them up immediately.
  async function primeGmbRoutes(list) {
    if (!state.index) return;
    const cache = state.gmbEnrichCache = state.gmbEnrichCache || new Set();
    const missing = list.filter((it) => {
      // We treat "enriched" as having at least one entry under GMB in routes map.
      const key = makeRouteKey('GMB', `${it.region}-${it.code}`, 'O', '1');
      return !state.index.routes.has(key) && !cache.has(`${it.region}/${it.code}`);
    });
    if (missing.length === 0) return;

    const BATCH = 80;
    for (let off = 0; off < missing.length; off += BATCH) {
      const slice = missing.slice(off, off + BATCH);
      await mapWithConcurrency(slice, 6, async (item) => {
        cache.add(`${item.region}/${item.code}`);
        try {
          const resp = await fetchGmbRoute(item.region, item.code);
          const arr = (resp && Array.isArray(resp.data)) ? resp.data : [];
          for (const r of arr) {
            const dircode = (r.directions && r.directions.length) ? r.directions[0].route_seq : 1;
            const key = makeRouteKey('GMB', `${item.region}-${item.code}`, String(dircode), String(r.route_id));
            const dirInfo = (r.directions && r.directions[0]) || {};
            state.index.routes.set(key, {
              co: 'GMB',
              route: `${item.region}-${item.code}`,
              dir: String(dircode),
              service: String(r.route_id),
              origTc: dirInfo.orig_tc || '',
              origEn: dirInfo.orig_en || '',
              destTc: dirInfo.dest_tc || '',
              destEn: dirInfo.dest_en || '',
              _region: item.region,
              _code: item.code,
              _routeId: r.route_id,
              _routeSeq: dircode,
            });
          }
          // Persist the index occasionally.
          persistIndexThrottled();
        } catch {}
      });
    }
  }

  let _persistTimer = null;
  function persistIndexThrottled() {
    if (_persistTimer) return;
    _persistTimer = setTimeout(() => {
      _persistTimer = null;
      if (!state.index) return;
      storage.set(STORAGE_KEYS.INDEX, dehydrateIndex(state.index));
    }, 800);
  }

  // Fetch a single GMB stop's coordinates and remember them.
  async function primeGmbStopCoord(stopId) {
    if (!state.index) return null;
    const stop = state.index.stops.get(stopId);
    if (stop && Number.isFinite(stop.lat) && Number.isFinite(stop.lng)) return stop;
    try {
      const resp = await fetchGmbStopCoord(stopId);
      const data = resp && resp.data;
      if (!data || !data.coordinates) return null;
      const lat = Number(data.coordinates.wgs84.latitude);
      const lng = Number(data.coordinates.wgs84.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const out = state.index.stops.get(stopId) || { stop: stopId, nameTc: '', nameEn: '' };
      out.lat = lat; out.lng = lng;
      if (data.name_tc && !out.nameTc) out.nameTc = data.name_tc;
      if (data.name_en && !out.nameEn) out.nameEn = data.name_en;
      state.index.stops.set(stopId, out);
      return out;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Geolocation
  // ------------------------------------------------------------------
  function requestLocation() {
    if (state.locationStatus === 'pending' || state.locationStatus === 'ok') return;
    if (!navigator.geolocation) { state.locationStatus = 'unavailable'; renderSearchStatus(); return; }
    state.locationStatus = 'pending';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        state.locationStatus = 'ok';
        if (currentRoute() === 'search') renderNearby();
      },
      (err) => {
        state.locationStatus = err && err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable';
        if (currentRoute() === 'search') renderNearby();
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 10_000 }
    );
  }

  // ------------------------------------------------------------------
  // Routing
  // ------------------------------------------------------------------
  function parseHash() {
    const h = location.hash.replace(/^#/, '') || '/';
    if (h === '/' || h === '') return { view: 'home' };
    if (h === '/search') return { view: 'search' };
    let m = h.match(/^\/route\/([^/]+)\/([^/]+)\/([^/]+)\/(.*)$/);
    if (m) return { view: 'route', co: decodeURIComponent(m[1]), route: decodeURIComponent(m[2]), dir: decodeURIComponent(m[3]), service: decodeURIComponent(m[4]) };
    m = h.match(/^\/stop\/(.+)$/);
    if (m) return { view: 'stop', stop: decodeURIComponent(m[1]) };
    return { view: 'error' };
  }
  function currentRoute() { return parseHash().view; }

  function showView(name) {
    ['splash', 'view-home', 'view-search', 'view-route', 'view-stop', 'view-error']
      .forEach((id) => {
        const node = document.getElementById(id);
        if (!node) return;
        const isThis = id === name;
        node.hidden = !isThis;
        node.setAttribute('aria-hidden', String(!isThis));
      });
  }

  function renderInto(name, tplId) {
    const view = document.getElementById(`view-${name}`);
    const tpl = document.getElementById(`tpl-${tplId}`);
    view.innerHTML = '';
    view.appendChild(tpl.content.cloneNode(true));
    applyI18n(view);
    return view;
  }

  function applyI18n(root) {
    $$('[data-i18n]', root).forEach((n) => { n.textContent = t_str(n.dataset.i18n); });
    $$('[data-i18n-attr]', root).forEach((n) => {
      try {
        const map = JSON.parse(n.dataset.i18nAttr);
        for (const [attr, key] of Object.entries(map)) n.setAttribute(attr, t_str(key));
      } catch {}
    });
    $$('[data-i18n-html]', root).forEach((n) => { n.innerHTML = t_str(n.dataset.i18nHtml); });
  }

  function onHashChange() {
    const r = parseHash();
    // Bottom nav active state
    let active = 'home';
    if (r.view === 'search') active = 'search';
    else if (r.view === 'home') active = 'home';
    else if (r.view === 'route' || r.view === 'stop') active = 'home';
    $$('.nav-item').forEach((n) => n.classList.toggle('is-active', n.dataset.route === active));

    // Hide splash once we navigate
    const splash = document.getElementById('splash');
    if (splash && !splash.hidden) splash.hidden = true;

    switch (r.view) {
      case 'home': renderHome(); break;
      case 'search': renderSearch(); break;
      case 'route': renderRoute(r); break;
      case 'stop': renderStop(r); break;
      default: renderError();
    }
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------
  // Home
  // ------------------------------------------------------------------
  function renderHome() {
    showView('view-home');
    const view = renderInto('home', 'home');

    const savedRoutesEl = $('[data-bind="savedRoutes"]', view);
    if (state.savedRoutes.length === 0) {
      savedRoutesEl.appendChild(el('p', { class: 'empty' }, t_str('emptyRoutes')));
    } else {
      const ul = el('div', { class: 'list' });
      state.savedRoutes.forEach((r) => ul.appendChild(routeRow(r)));
      savedRoutesEl.appendChild(ul);
    }

    const savedStopsEl = $('[data-bind="savedStops"]', view);
    if (state.savedStops.length === 0) {
      savedStopsEl.appendChild(el('p', { class: 'empty' }, t_str('emptyStops')));
    } else {
      const ul = el('div', { class: 'list' });
      state.savedStops.forEach((s) => ul.appendChild(stopRow(s)));
      savedStopsEl.appendChild(ul);
    }

    const recentEl = $('[data-bind="recent"]', view);
    if (state.recent.length === 0) {
      recentEl.appendChild(el('p', { class: 'empty' }, t_str('emptyRecent')));
    } else {
      const ul = el('div', { class: 'list' });
      state.recent.slice(0, 8).forEach((r) => {
        if (r.stop) ul.appendChild(stopRow({ stop: r.stop }));
        else if (r.route) ul.appendChild(routeRow(r));
      });
      recentEl.appendChild(ul);
      recentEl.appendChild(el('button', {
        class: 'btn-secondary', style: 'margin-top: 12px; color: var(--ink); background: var(--bg-soft);',
        onclick: () => { state.recent = []; persist(); renderHome(); toast(t_str('cleared')); },
      }, t_str('clearRecent')));
    }
  }

  // ------------------------------------------------------------------
  // Search
  // ------------------------------------------------------------------
  function renderSearch() {
    showView('view-search');
    const view = renderInto('search', 'search');

    const input = $('#searchInput', view);
    input.value = state.lastSearchQ;
    input.addEventListener('input', debounce(() => {
      state.lastSearchQ = input.value.trim();
      renderResults();
    }, 120));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.value = ''; state.lastSearchQ = ''; renderResults(); }
    });

    const clear = $('#searchClear', view);
    clear.hidden = !state.lastSearchQ;
    clear.addEventListener('click', () => { input.value = ''; state.lastSearchQ = ''; renderResults(); input.focus(); });

    $$('.filter-pill', view).forEach((pill) => {
      pill.addEventListener('click', () => {
        state.filter = pill.dataset.co;
        $$('.filter-pill', view).forEach((p) => {
          const on = p.dataset.co === state.filter;
          p.classList.toggle('is-on', on);
          p.setAttribute('aria-pressed', String(on));
        });
        renderResults();
      });
    });

    renderResults();
    renderNearby();
  }

  function renderResults() {
    const view = $('#view-search');
    if (!view) return;
    const out = $('[data-bind="searchResults"]', view);
    if (!out) return;
    out.innerHTML = '';
    const q = state.lastSearchQ;
    if (!q) {
      out.appendChild(el('p', { class: 'empty', style: 'margin-top: 8px;' }, t_str('searchHint')));
      out.appendChild(el('p', { class: 'empty', style: 'margin-top: 8px; border-style: solid;' }, t_str('noFavHint')));
      return;
    }
    const matches = searchIndex(q);
    if (matches.length === 0) {
      out.appendChild(el('p', { class: 'empty', style: 'margin-top: 8px;' }, t_str('noResults')));
      return;
    }
    const ul = el('div', { class: 'list' });
    matches.forEach((m) => {
      if (m.kind === 'route') ul.appendChild(routeRow(m.data));
      else ul.appendChild(stopRow(m.data));
    });
    out.appendChild(ul);
  }

  function searchIndex(q) {
    const lower = q.toLowerCase();
    const norm = (s) => (s || '').toLowerCase();
    const matches = [];
    const seen = new Set();

    const push = (kind, data, score) => {
      const key = kind + '|' + (kind === 'stop' ? data.stop : makeRouteKey(data.co, data.route, data.dir, data.service));
      if (seen.has(key)) return;
      seen.add(key);
      matches.push({ kind, data, score });
    };

    // --- Bus (KMB / LWB / CTB / NWFB / GMB) ---
    // Dedupe to one row per (co, route, service) so the user does not see
    // inbound and outbound of the same physical route listed twice. The
    // best-scoring direction (usually the one whose end-points match the
    // query) wins; the survivor gets a "+N dir" badge.
    const seenRoutes = new Map();
    const tryRoute = (r, map) => {
      if (!matchesFilter(r.co)) return;
      const rlow = String(r.route).toLowerCase();
      const text = `${norm(r.origTc)} ${norm(r.origEn)} ${norm(r.destTc)} ${norm(r.destEn)}`;
      let score = 0;
      if (rlow === lower) score += 100;
      else if (rlow.startsWith(lower)) score += 50;
      else if (rlow.includes(lower)) score += 30;
      if (text.includes(lower)) score += 10;
      if (score <= 0) return;
      const routeKey = `${r.co}|${r.route}`;
      const prior = seenRoutes.get(routeKey);
      if (prior) {
        if (score > prior.score) {
          const idx = matches.findIndex((m) => m.kind === 'route' && m.data === prior.data);
          if (idx >= 0) matches[idx] = { kind: 'route', data: r, score };
          seenRoutes.set(routeKey, { data: r, score, count: prior.count + 1 });
        } else {
          prior.count += 1;
        }
        return;
      }
      seenRoutes.set(routeKey, { data: r, score, count: 1 });
      push('route', r, score);
    };
    state.index.routes.forEach((r) => tryRoute(r, state.index.routes));
    state.index.ctbRoutes.forEach((r) => tryRoute(r, state.index.ctbRoutes));

    // --- MTR ---
    if (state.filter === 'ALL' || state.filter === 'MTR') {
      state.index.mtr.forEach((r, code) => {
        // Skip line entries (those are routed via station search).
        if (r._isLine) {
          const lname = `${norm(r.origTc)} ${norm(r.origEn)}`;
          let score = 0;
          if (String(code).toLowerCase() === lower) score += 90;
          else if (String(code).toLowerCase().startsWith(lower)) score += 50;
          else if (lname.includes(lower)) score += 20;
          if (score > 0) push('route', { ...r, route: code, service: '', dir: '', _lineView: true }, score);
        } else {
          // Station
          const text = `${norm(r.nameTc)} ${norm(r.nameEn)}`;
          let score = 0;
          if (text.includes(lower)) score += 10;
          if (String(code).toLowerCase() === lower) score += 80;
          if (score > 0) push('stop', r, score);
        }
      });
    }

    // --- Light Rail ---
    if (state.filter === 'ALL' || state.filter === 'MTR') {
      state.index.lrt.routes.forEach((r) => {
        const rlow = String(r.route).toLowerCase();
        const text = `${norm(r.origTc)} ${norm(r.origEn)} ${norm(r.destTc)} ${norm(r.destEn)}`;
        let score = 0;
        if (rlow === lower) score += 100;
        else if (rlow.startsWith(lower)) score += 50;
        else if (rlow.includes(lower)) score += 30;
        if (text.includes(lower)) score += 10;
        if (score <= 0) return;
        const routeKey = `LRT|${r.route}`;
        const prior = seenRoutes.get(routeKey);
        if (prior) {
          if (score > prior.score) {
            const idx = matches.findIndex((m) => m.kind === 'route' && m.data === prior.data);
            if (idx >= 0) matches[idx] = { kind: 'route', data: r, score };
            seenRoutes.set(routeKey, { data: r, score, count: prior.count + 1 });
          } else {
            prior.count += 1;
          }
          return;
        }
        seenRoutes.set(routeKey, { data: r, score, count: 1 });
        push('route', r, score);
      });
      state.index.lrt.stops.forEach((s) => {
        const text = `${norm(s.nameTc)} ${norm(s.nameEn)}`;
        let score = 0;
        if (text.includes(lower)) score += 10;
        if (s.stop.toLowerCase() === lower) score += 80;
        if (score > 0) push('stop', s, score);
      });
    }

    // --- Bus stops (KMB / CTB / GMB) ---
    // Track the highest-scoring stop per (nameTc, nameEn) so we surface one
    // row per distinct stop name — KMB / CTB / GMB all have multiple
    // physically distinct stops that share a name (different sides of a
    // road, terminus variants, etc.). The first hit wins and any later
    // same-name entries bump the "more" count so the user can still
    // navigate to the exact one if needed.
    const seenNames = new Map();
    state.index.stops.forEach((s) => {
      const text = `${norm(s.nameTc)} ${norm(s.nameEn)}`;
      let score = 0;
      if (text.includes(lower)) score += 10;
      if (s.stop.toLowerCase() === lower) score += 80;
      if (score <= 0) return;
      const nameKey = `${s.nameTc || ''}||${s.nameEn || ''}`;
      const prior = seenNames.get(nameKey);
      if (prior) {
        if (score > prior.score) {
          // Replace the lower-scoring earlier entry with this one.
          const idx = matches.findIndex((m) => m.kind === 'stop' && m.data === prior.data);
          if (idx >= 0) matches[idx] = { kind: 'stop', data: s, score };
          seenNames.set(nameKey, { data: s, score, count: prior.count + 1 });
        } else {
          prior.count += 1;
        }
        return;
      }
      seenNames.set(nameKey, { data: s, score, count: 1 });
      push('stop', s, score);
    });

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, 80);
  }

  function matchesFilter(co) {
    if (state.filter === 'ALL') return true;
    if (state.filter === 'KMB') return co === 'KMB' || co === 'LWB';
    if (state.filter === 'LWB') return co === 'LWB';
    if (state.filter === 'CTB') return co === 'CTB' || co === 'NWFB';
    if (state.filter === 'GMB') return co === 'GMB';
    if (state.filter === 'MTR') return co === 'MTR' || co === 'LRT';
    return true;
  }

  // ------------------------------------------------------------------
  // Nearby
  // ------------------------------------------------------------------
  function renderNearby() {
    const view = $('#view-search');
    if (!view) return;
    const status = $('[data-bind="nearbyStatus"]', view);
    const status2 = $('[data-bind="nearbyStatus2"]', view);
    const status3 = $('[data-bind="nearbyStatus3"]', view);
    if (!status || !status2) return;

    if (state.locationStatus === 'idle') {
      status.textContent = t_str('locating');
      status2.textContent = t_str('locating');
      if (status3) status3.textContent = t_str('locating');
      requestLocation();
      return;
    }
    if (state.locationStatus === 'pending') {
      status.textContent = t_str('locating');
      status2.textContent = t_str('locating');
      if (status3) status3.textContent = t_str('locating');
      return;
    }
    if (state.locationStatus === 'denied') {
      status.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('locationDenied')));
      status2.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('locationDenied')));
      if (status3) status3.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('locationDenied')));
      return;
    }
    if (state.locationStatus === 'unavailable') {
      status.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('locationUnavailable')));
      status2.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('locationUnavailable')));
      if (status3) status3.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('locationUnavailable')));
      return;
    }

    // --- Nearby bus stops (only KMB/CTB/etc — stops we have lat/lng for) ---
    const nearbyStops = Array.from(state.index.stops.values())
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .map((s) => ({ s, d: haversine(state.location.lat, state.location.lng, s.lat, s.lng) }))
      .filter((x) => x.d < 1.2)
      .sort((a, b) => a.d - b.d)
      .slice(0, 12);

    if (nearbyStops.length === 0) {
      status.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('noNearbyStops')));
      status2.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('noNearbyRoutes')));
    } else {
      Promise.allSettled(nearbyStops.map((x) => fetchKmbStopEta(x.s.stop))).then((results) => {
        const routeMap = new Map();
        const stopItems = [];
        results.forEach((rr, i) => {
          const stop = nearbyStops[i].s;
          const dist = nearbyStops[i].d;
          const etas = (rr.status === 'fulfilled' && rr.value && Array.isArray(rr.value.data))
            ? rr.value.data.filter((e) => e.eta).slice(0, 3)
            : [];
          stopItems.push({ stop, dist, etas });
          etas.forEach((e) => {
            const co = classifyKmbOp(e.route, '', e.dest_tc || '');
            const key = makeRouteKey(co, e.route, e.dir, e.service_type);
            if (!routeMap.has(key)) {
              routeMap.set(key, {
                co, route: e.route, dir: e.dir, service: e.service_type,
                origTc: '', origEn: '',
                destTc: e.dest_tc, destEn: e.dest_en,
                firstEta: e.eta, etaCount: 1,
              });
            } else {
              routeMap.get(key).etaCount += 1;
            }
          });
        });

        const stopsBlock = $('[data-bind="nearbyStops"]', view);
        const routesBlock = $('[data-bind="nearbyRoutes"]', view);
        if (stopsBlock) stopsBlock.replaceChildren(buildNearbyStops(stopItems));
        if (routesBlock) routesBlock.replaceChildren(buildNearbyRoutes(Array.from(routeMap.values())));
      });
    }

    // --- Nearby MTR stations (using embedded coords from mtr-stops.json) ---
    const nearbyMtr = Array.from(state.index.mtr.values())
      .filter((st) => st && !st._isLine)
      .filter((st) => Number.isFinite(st.lat) && Number.isFinite(st.lng))
      .map((st) => ({ st, d: haversine(state.location.lat, state.location.lng, st.lat, st.lng) }))
      .filter((x) => x.d < 1.5)
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);

    if (!status3) return;
    if (nearbyMtr.length === 0) {
      status3.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('noNearbyStations')));
    } else {
      Promise.allSettled(nearbyMtr.map((x) => {
        const line = (x.st.lines && x.st.lines[0]) || null;
        return line ? fetchMtrSchedule(line, x.st.stop).catch(() => null) : Promise.resolve(null);
      })).then((results) => {
        const block = $('[data-bind="nearbyStations"]', view);
        if (block) block.replaceChildren(buildNearbyStations(nearbyMtr, results));
      });
    }
  }

  function buildNearbyStops(items) {
    const root = el('div');
    root.appendChild(el('h2', { class: 'section-title' }, t_str('nearbyStops')));
    if (items.length === 0) {
      root.appendChild(el('p', { class: 'muted' }, t_str('noNearbyStops')));
      return root;
    }
    const list = el('div', { class: 'list' });
    items.forEach(({ stop, dist, etas }) => {
      const name = pickFirst(stop.nameTc, stop.nameEn);
      const row = el('a', { class: 'row', href: `#/stop/${encodeURIComponent(stop.stop)}` });
      row.appendChild(makeBadge(stop.co || 'STOP'));
      const main = el('div', { class: 'row-main' });
      main.appendChild(el('div', { class: 'row-title' }, name));
      main.appendChild(el('div', { class: 'row-sub' }, formatDistance(dist)));
      row.appendChild(main);
      const meta = el('div', { class: 'row-meta' });
      if (etas.length > 0) meta.appendChild(etaSpan(etas[0].eta));
      else meta.appendChild(el('div', { class: 'row-dim' }, t_str('noEta')));
      row.appendChild(meta);
      row.appendChild(makeChev());
      list.appendChild(row);
    });
    root.appendChild(list);
    return root;
  }

  function buildNearbyStations(items, results) {
    const root = el('div');
    root.appendChild(el('h2', { class: 'section-title' }, t_str('nearbyStations')));
    const list = el('div', { class: 'list' });
    items.forEach((item, i) => {
      const st = item.st;
      const name = pickFirst(st.nameTc, st.nameEn);
      const line = (st.lines && st.lines[0]) || '';
      const href = `#/route/MTR/${encodeURIComponent(st.stop)}/STATION/`;
      const row = el('a', { class: 'row', href });
      row.appendChild(makeBadge('MTR'));
      const main = el('div', { class: 'row-main' });
      main.appendChild(el('div', { class: 'row-title' }, name));
      main.appendChild(el('div', { class: 'row-sub' }, `${line ? line + ' · ' : ''}${formatDistance(item.d)}`));
      row.appendChild(main);
      const meta = el('div', { class: 'row-meta' });
      const rr = results[i];
      if (rr && rr.status === 'fulfilled' && rr.value && rr.value.data) {
        const key = `${line}-${st.stop}`;
        const d = rr.value.data[key];
        const train = (d && d.UP && d.UP[0]) || (d && d.DOWN && d.DOWN[0]) || null;
        const m = train ? parseInt(train.ttnt, 10) : null;
        if (Number.isFinite(m)) {
          if (m <= 0) meta.appendChild(el('span', { class: 'row-eta is-now' }, t_str('arriving')));
          else meta.appendChild(el('span', { class: 'row-eta' + (m <= 2 ? ' is-soon' : '') }, `${m} ${t_str('minShort')}`));
        } else {
          meta.appendChild(el('div', { class: 'row-dim' }, t_str('noEta')));
        }
      } else {
        meta.appendChild(el('div', { class: 'row-dim' }, t_str('noEta')));
      }
      row.appendChild(meta);
      row.appendChild(makeChev());
      list.appendChild(row);
    });
    root.appendChild(list);
    return root;
  }

  function buildNearbyRoutes(items) {
    const root = el('div');
    root.appendChild(el('h2', { class: 'section-title' }, t_str('nearbyRoutes')));
    if (items.length === 0) {
      root.appendChild(el('p', { class: 'muted' }, t_str('noNearbyRoutes')));
      return root;
    }
    const list = el('div', { class: 'list' });
    items.slice(0, 12).forEach((r) => {
      const data = {
        co: r.co, route: r.route, dir: r.dir, service: r.service,
        origTc: r.origTc, origEn: r.origEn,
        destTc: r.destTc, destEn: r.destEn,
      };
      const row = routeRow(data);
      const meta = $('.row-meta', row);
      meta.appendChild(etaSpan(r.firstEta));
      if (r.etaCount > 1) meta.appendChild(el('div', { class: 'row-dim' }, t_str('etaCount', r.etaCount - 1)));
      list.appendChild(row);
    });
    root.appendChild(list);
    return root;
  }

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  function formatDistance(km) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  }

  // ------------------------------------------------------------------
  // Row builders
  // ------------------------------------------------------------------
  function makeBadge(co) {
    if (co === 'STOP') return el('span', { class: 'row-badge co-STOP' }, '·');
    if (co === 'MTR') return el('span', { class: 'row-badge co-MTR', 'aria-label': 'MTR' }, 'M');
    if (co === 'LRT') return el('span', { class: 'row-badge co-LRT', 'aria-label': 'Light Rail' }, 'L');
    return el('span', { class: `row-badge co-${co}` }, co);
  }

  function makeChev() {
    return el('span', { class: 'chev' },
      (() => {
        const x = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        x.setAttribute('viewBox', '0 0 24 24');
        x.setAttribute('width', '18');
        x.setAttribute('height', '18');
        x.setAttribute('aria-hidden', 'true');
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', 'currentColor');
        p.setAttribute('stroke-width', '1.8');
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('d', 'M9 6l6 6-6 6');
        x.appendChild(p);
        return x;
      })()
    );
  }

  function routeRow(r) {
    // MTR line view: special rendering.
    if (r.co === 'MTR' && r._isLine) {
      const dest = pickFirst(r.destTc, r.destEn);
      const a = el('a', {
        class: 'row',
        href: `#/route/${encodeURIComponent('MTR')}/${encodeURIComponent(r.route)}/${encodeURIComponent('LINE')}/${encodeURIComponent('')}`,
      });
      a.appendChild(makeBadge('MTR'));
      const main = el('div', { class: 'row-main' });
      main.appendChild(el('div', { class: 'row-title' }, r.route,
        el('span', { style: 'color: var(--muted); margin: 0 6px; font-weight: 500;' }, '·'),
        dest));
      main.appendChild(el('div', { class: 'row-sub' }, dest));
      a.appendChild(main);
      a.appendChild(el('div', { class: 'row-meta' }, el('div', { class: 'row-dim' }, t_str('line'))));
      a.appendChild(makeChev());
      return a;
    }

    const dirLabel = r.co === 'MTR' || r.co === 'LRT'
      ? (r.dir === 'UP' || r.dir === '1' || r.dir === 'O' ? t_str('dirUp') : t_str('dirDown'))
      : (r.dir === 'I' ? t_str('inbound') : t_str('outbound'));
    const dest = pickFirst(r.destTc, r.destEn);
    const orig = pickFirst(r.origTc, r.origEn);
    const displayRoute = r.co === 'GMB' && r._region && r._code ? `${r._code} (${r._region})` : r.route;
    const a = el('a', {
      class: 'row',
      href: `#/route/${encodeURIComponent(r.co)}/${encodeURIComponent(r.route)}/${encodeURIComponent(r.dir)}/${encodeURIComponent(r.service)}`,
    });
    a.appendChild(makeBadge(r.co));
    const main = el('div', { class: 'row-main' });
    const titleEl = el('div', { class: 'row-title' });
    titleEl.appendChild(document.createTextNode(displayRoute));
    titleEl.appendChild(el('span', { style: 'color: var(--muted); margin: 0 6px; font-weight: 500;' }, '·'));
    titleEl.appendChild(document.createTextNode(dest));
    main.appendChild(titleEl);
    main.appendChild(el('div', { class: 'row-sub' }, r.co === 'GMB' ? orig : `${dirLabel} · ${orig}`));
    a.appendChild(main);
    a.appendChild(el('div', { class: 'row-meta' }, el('div', { class: 'row-dim' }, t_str(opCoKey(r.co)))));
    a.appendChild(makeChev());
    return a;
  }

  function stopRow(s) {
    const a = el('a', { class: 'row', href: `#/stop/${encodeURIComponent(s.stop)}` });
    a.appendChild(makeBadge(s.co || 'STOP'));
    const main = el('div', { class: 'row-main' });
    main.appendChild(el('div', { class: 'row-title' }, pickFirst(s.nameTc, s.nameEn) || s.stop));
    const subInfo = s.lines ? s.lines.join(' · ') : (s.nameEn || (s.stop ? String(s.stop).slice(0, 12) : ''));
    main.appendChild(el('div', { class: 'row-sub' }, subInfo));
    a.appendChild(main);
    const metaLabel = s.co === 'MTR' ? t_str('station') : t_str('stop');
    a.appendChild(el('div', { class: 'row-meta' }, el('div', { class: 'row-dim' }, metaLabel)));
    a.appendChild(makeChev());
    return a;
  }

  function etaSpan(etaIso) {
    const span = el('span', { class: 'row-eta' });
    const minutes = minutesUntil(etaIso);
    if (minutes == null) span.textContent = '–';
    else if (minutes <= 0) { span.textContent = t_str('arriving'); span.classList.add('is-now'); }
    else if (minutes === 1) { span.textContent = `1 ${t_str('minShort')}`; span.classList.add('is-soon'); }
    else { span.textContent = `${minutes} ${t_str('minShort')}`; if (minutes <= 2) span.classList.add('is-soon'); }
    return span;
  }

  function minutesUntil(iso) {
    if (!iso) return null;
    const ms = new Date(iso).getTime() - Date.now();
    if (Number.isNaN(ms)) return null;
    if (ms < 0) return 0;
    return Math.max(0, Math.round(ms / 60000));
  }

  // ------------------------------------------------------------------
  // Route detail
  // ------------------------------------------------------------------
  function renderRoute(r) {
    state.detailRoute = r;
    state.detailStop = null;
    stopEtaRefresh();

    // --- MTR heavy rail line ---
    if (r.co === 'MTR' && r.dir === 'LINE') {
      return renderMtrLineRoute(r);
    }
    // --- MTR station (route entry whose service === station_code) ---
    if (r.co === 'MTR') {
      return renderMtrStationRoute(r);
    }
    // --- Light Rail route ---
    if (r.co === 'LRT') {
      return renderLrtRoute(r);
    }
    // --- Green minibus ---
    if (r.co === 'GMB') {
      return renderGmbRoute(r);
    }
    return renderBusRoute(r);
  }

  function renderBusRoute(r) {
    showView('view-route');
    const view = renderInto('route', 'route');
    const header = $('[data-bind="routeHeader"]', view);
    const body = $('[data-bind="routeBody"]', view);
    header.innerHTML = '';
    body.innerHTML = '';

    const key = makeRouteKey(r.co, r.route, r.dir, r.service);
    const meta = state.index.routes.get(key) || state.index.ctbRoutes.get(key) || null;
    const dest = meta ? pickFirst(meta.destTc, meta.destEn) : r.route;
    const orig = meta ? pickFirst(meta.origTc, meta.origEn) : '';
    const origEn = meta ? meta.origEn || '' : '';
    const dirLabel = r.dir === 'I' ? t_str('inbound') : t_str('outbound');

    // Build direction pills: same route, other bound(s).
    const directions = buildDirectionPills(r.co, r.route, r.service, dirLabel);
    header.appendChild(buildRouteHeader({
      co: r.co, route: r.route, dir: r.dir, service: r.service,
      dest, orig, origEn, dirLabel, fare: meta && meta.fares && meta.fares[0],
      directions, currentDirKey: key, currentDirKeyDir: r.dir,
    }));
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    fetchKmbRouteStop(r.route, r.dir, r.service).then(async (resp) => {
      const items = (resp && Array.isArray(resp.data)) ? resp.data : [];
      if (items.length === 0) {
        body.replaceChildren(el('p', { class: 'empty' }, t_str('routeNotFound')));
        return;
      }
      const stops = items
        .sort((a, b) => parseInt(a.seq, 10) - parseInt(b.seq, 10))
        .map((it) => state.index.stops.get(it.stop) || { stop: it.stop, nameTc: it.stop, nameEn: '', lat: null, lng: null });

      const firstStops = stops.slice(0, 4);
      const etaResults = await Promise.allSettled(firstStops.map((s) => fetchKmbStopEta(s.stop)));
      const etaByStop = new Map();
      firstStops.forEach((s, i) => {
        const rr = etaResults[i];
        if (rr.status === 'fulfilled' && rr.value && Array.isArray(rr.value.data)) {
          etaByStop.set(s.stop, rr.value.data
            .filter((e) => e.route === r.route && e.dir === r.dir && String(e.service_type) === String(r.service))
            .sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime()));
        }
      });

      const list = el('div', { class: 'eta-list' });
      stops.forEach((s, idx) => {
        const isOrigin = idx === 0;
        const row = el('a', { class: `stop-row${isOrigin ? ' is-origin' : ''}`, href: `#/stop/${encodeURIComponent(s.stop)}` });
        row.appendChild(el('span', { class: 'stop-idx' }, String(idx + 1)));
        const info = el('div', { class: 'stop-info' });
        info.appendChild(el('div', { class: 'stop-name-row' }, pickFirst(s.nameTc, s.nameEn) || s.stop));
        if (s.nameEn) info.appendChild(el('div', { class: 'stop-name-en' }, s.nameEn));
        row.appendChild(info);
        const etaBox = el('div', { class: 'stop-eta' });
        const etas = etaByStop.get(s.stop) || [];
        if (etas.length > 0) {
          const big = el('span', { class: 'big' });
          const m = minutesUntil(etas[0].eta);
          if (m == null) big.textContent = '–';
          else if (m <= 0) { big.textContent = t_str('arriving'); big.classList.add('is-now'); }
          else { big.textContent = `${m} ${t_str('minShort')}`; if (m <= 2) big.classList.add('is-soon'); }
          etaBox.appendChild(big);
          etaBox.appendChild(el('span', { class: 'small' },
            etas.length > 1 ? t_str('etaCount', etas.length - 1) : (etas[0].rmk_en === 'Scheduled Bus' ? t_str('scheduled') : '')));
        } else if (idx === 0) {
          etaBox.appendChild(el('span', { class: 'small' }, t_str('loading')));
        } else {
          etaBox.appendChild(el('span', { class: 'small', style: 'color: var(--muted-2);' }, t_str('noEta')));
        }
        row.appendChild(etaBox);
        list.appendChild(row);
      });
      body.replaceChildren(el('h2', { class: 'section-title' }, t_str('showingStop', stops.length)), list);
    }).catch(() => {
      body.replaceChildren(el('p', { class: 'empty' }, t_str('routeNotFound')));
    });

    startEtaRefresh(renderRouteDetail);
  }

  // ---- MTR heavy-rail LINE (all stations on a line) ----
  function renderMtrLineRoute(r) {
    showView('view-route');
    const view = renderInto('route', 'route');
    const header = $('[data-bind="routeHeader"]', view);
    const body = $('[data-bind="routeBody"]', view);
    header.innerHTML = '';
    body.innerHTML = '';

    const lineCode = r.route;
    const lineMeta = state.index.mtr.get(`MTR|${lineCode}`);
    const lineLabel = lineMeta ? pickFirst(lineMeta.origTc, lineMeta.origEn) : lineCode;

    header.appendChild(buildRouteHeader({
      co: 'MTR', route: lineCode, dir: 'LINE', service: '',
      dest: lineLabel, orig: t_str('allLines'), origEn: lineMeta ? lineMeta.origEn : '',
      dirLabel: '', fare: null, directions: [],
      currentDirKey: `MTR|${lineCode}|LINE|`,
    }));
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    // Build the list of stations on this line (in sequence for a representative direction).
    // Pull from state.index.mtr lines: each MTR station entry has lines:[...].
    const stations = [];
    const seen = new Set();
    state.index.mtr.forEach((st, code) => {
      if (st._isLine) return;
      if (st.lines && st.lines.includes(lineCode)) {
        // Use dir+code to find sequence.
        const seq = st._dirs && st._dirs.length ? (st._seq || 0) : 0;
        if (!seen.has(code)) {
          seen.add(code);
          stations.push({ code, ...st });
        }
      }
    });

    // For each station, fetch ETA concurrently.
    Promise.allSettled(stations.map((s) => fetchMtrSchedule(lineCode, s.code))).then((results) => {
      const list = el('div', { class: 'eta-list' });
      stations.forEach((s, idx) => {
        const rr = results[idx];
        let upNext = null, downNext = null;
        if (rr.status === 'fulfilled' && rr.value && rr.value.data) {
          const key = `${lineCode}-${s.code}`;
          const d = rr.value.data[key] || {};
          upNext = (d.UP && d.UP[0]) || null;
          downNext = (d.DOWN && d.DOWN[0]) || null;
          // Or other direction keys (e.g. LMC-DT, DT) — but display first one available.
        }
        const isOrigin = idx === 0;
        const row = el('a', {
          class: `stop-row${isOrigin ? ' is-origin' : ''}`,
          href: `#/route/MTR/${encodeURIComponent(s.code)}/${encodeURIComponent('STATION')}/${encodeURIComponent('')}`,
        });
        row.appendChild(el('span', { class: 'stop-idx' }, String(idx + 1)));
        const info = el('div', { class: 'stop-info' });
        info.appendChild(el('div', { class: 'stop-name-row' }, pickFirst(s.nameTc, s.nameEn) || s.code));
        if (s.nameEn) info.appendChild(el('div', { class: 'stop-name-en' }, s.nameEn));
        row.appendChild(info);
        const etaBox = el('div', { class: 'stop-eta' });
        const minutes = (upNext && upNext.ttnt != null) ? parseInt(upNext.ttnt, 10) : null;
        if (minutes == null || Number.isNaN(minutes)) {
          etaBox.appendChild(el('span', { class: 'small', style: 'color: var(--muted-2);' }, t_str('noEta')));
        } else if (minutes <= 0) {
          etaBox.appendChild(el('span', { class: 'big is-now' }, t_str('arriving')));
        } else {
          etaBox.appendChild(el('span', { class: 'big' + (minutes <= 2 ? ' is-soon' : '') }, `${minutes} ${t_str('minShort')}`));
        }
        row.appendChild(etaBox);
        list.appendChild(row);
      });
      body.replaceChildren(el('h2', { class: 'section-title' }, t_str('showingStop', stations.length)), list);
    }).catch(() => {
      body.replaceChildren(el('p', { class: 'empty' }, t_str('routeNotFound')));
    });

    startEtaRefresh(renderRouteDetail);
  }

  // ---- MTR station ----
  function renderMtrStationRoute(r) {
    showView('view-route');
    const view = renderInto('route', 'route');
    const header = $('[data-bind="routeHeader"]', view);
    const body = $('[data-bind="routeBody"]', view);
    header.innerHTML = '';
    body.innerHTML = '';

    const stationCode = r.route; // when dir === 'STATION', route holds station code
    const station = state.index.mtr.get(stationCode);
    const stationName = station ? pickFirst(station.nameTc, station.nameEn) : stationCode;
    const stationLines = (station && station.lines) || [];
    const dirLabel = ''; // station view shows both directions.

    header.appendChild(buildRouteHeader({
      co: 'MTR', route: stationCode, dir: 'STATION', service: '',
      dest: stationName, orig: stationLines.join(' · '), origEn: station ? station.nameEn : '',
      dirLabel: '', fare: null, directions: [],
      currentDirKey: `MTR|${stationCode}|STATION|`,
    }));
    body.innerHTML = '';
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    // Fetch ETA for each line passing through this station.
    Promise.allSettled(stationLines.map((line) => fetchMtrSchedule(line, stationCode))).then((results) => {
      const sections = [];
      stationLines.forEach((line, idx) => {
        const rr = results[idx];
        if (rr.status !== 'fulfilled' || !rr.value || !rr.value.data) return;
        const key = `${line}-${stationCode}`;
        const d = rr.value.data[key];
        if (!d) return;
        const lineMeta = state.index.mtr.get(`MTR|${line}`);
        const lineName = lineMeta ? pickFirst(lineMeta.origTc, lineMeta.origEn) : line;
        sections.push(renderMtrLineSection(line, lineName, d));
      });
      // Drop the loading placeholder.
      body.innerHTML = '';
      if (sections.length === 0) {
        body.appendChild(el('p', { class: 'empty' }, t_str('noEta')));
      } else {
        for (const sec of sections) body.appendChild(sec);
      }
      // Map at the bottom, just like justarrived.grok.me.
      if (station && Number.isFinite(station.lat) && Number.isFinite(station.lng)) {
        const mapEl = renderStopMap(station.lat, station.lng, stationName);
        if (mapEl.firstChild) body.appendChild(mapEl);
      }
    }).catch(() => {
      body.innerHTML = '';
      body.appendChild(el('p', { class: 'empty' }, t_str('noEta')));
    });

    startEtaRefresh(renderRouteDetail);
  }

  function renderMtrLineSection(lineCode, lineName, d) {
    const wrap = el('div', { class: 'eta-section' });
    const title = el('h2', { class: 'section-title' },
      el('span', { class: 'route-badge', style: 'display: inline-block; vertical-align: middle; margin-right: 8px;' }, lineCode),
      lineName);
    wrap.appendChild(title);

    const groups = [];
    for (const dir of ['UP', 'DOWN', 'DT', 'UT', 'LMC-DT', 'LMC-UT']) {
      const arr = d[dir];
      if (Array.isArray(arr) && arr.length) groups.push({ dir, trains: arr });
    }
    // If nothing matched known keys, fall back to scanning all keys.
    if (groups.length === 0) {
      for (const k of Object.keys(d)) {
        if (Array.isArray(d[k])) groups.push({ dir: k, trains: d[k] });
      }
    }
    if (groups.length === 0) {
      wrap.appendChild(el('p', { class: 'muted' }, t_str('noEta')));
      return wrap;
    }
    groups.forEach((g) => {
      const dirLabel = (g.dir === 'UP' || g.dir === 'UT' || g.dir === 'LMC-UT') ? t_str('dirUp') : t_str('dirDown');
      const heading = el('div', { class: 'eta-dir' }, `${dirLabel} · ${t_str('trains')}`);
      wrap.appendChild(heading);
      const list = el('div', { class: 'eta-list' });
      g.trains.slice(0, 4).forEach((tr) => {
        const row = el('div', { class: 'eta-row' });
        const time = el('div', { class: 'eta-time' });
        const m = parseInt(tr.ttnt, 10);
        if (!Number.isNaN(m)) {
          if (m <= 0) { time.textContent = t_str('arriving'); time.classList.add('is-now'); }
          else { time.textContent = `${m} ${t_str('minShort')}`; if (m <= 2) time.classList.add('is-soon'); }
        } else {
          time.textContent = tr.time || '–';
        }
        row.appendChild(time);
        const info = el('div', { class: 'eta-info' });
        const dest = tr.dest || '';
        info.appendChild(el('div', { class: 'eta-dest' }, dest ? `→ ${dest}` : ''));
        const plat = tr.plat ? `${t_str('platform')} ${tr.plat}` : '';
        info.appendChild(el('div', { class: 'eta-sub' }, plat));
        list.appendChild(row);
      });
      wrap.appendChild(list);
    });
    return wrap;
  }

  // ---- Light Rail route ----
  function renderLrtRoute(r) {
    showView('view-route');
    const view = renderInto('route', 'route');
    const header = $('[data-bind="routeHeader"]', view);
    const body = $('[data-bind="routeBody"]', view);
    header.innerHTML = '';
    body.innerHTML = '';

    const meta = state.index.lrt.routes.get(`LRT|${r.route}`);
    if (!meta) {
      body.replaceChildren(el('p', { class: 'empty' }, t_str('routeNotFound')));
      return;
    }
    const stopsForDir = meta._stops || [];
    const dirLabel = meta.dir === '1' ? t_str('dirUp') : t_str('dirDown');

    header.appendChild(buildRouteHeader({
      co: 'LRT', route: r.route, dir: meta.dir || '1', service: '',
      dest: pickFirst(meta.destTc, meta.destEn), orig: pickFirst(meta.origTc, meta.origEn),
      origEn: meta.destEn || '', dirLabel, fare: null,
      directions: buildDirectionPills('LRT', r.route, '', dirLabel),
      currentDirKey: `LRT|${r.route}|${meta.dir || '1'}|`,
    }));
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    // Fetch LRT schedules for first 3 stops concurrently.
    const firstStops = stopsForDir.slice(0, 3);
    Promise.allSettled(firstStops.map((s) => fetchLrtSchedule(s.id || s.stop))).then((results) => {
      const etaByStop = new Map();
      firstStops.forEach((s, i) => {
        const rr = results[i];
        if (rr.status === 'fulfilled' && rr.value && Array.isArray(rr.value.platform_list)) {
          const trains = [];
          for (const p of rr.value.platform_list) {
            for (const tr of (p.route_list || [])) {
              if (String(tr.route_no) === String(r.route) && tr.time_ch) {
                trains.push({ route_no: tr.route_no, dest_ch: tr.dest_ch, time_ch: tr.time_ch, time_en: tr.time_en, special: tr.special });
              }
            }
          }
          etaByStop.set(s.stop, trains);
        }
      });

      const list = el('div', { class: 'eta-list' });
      stopsForDir.forEach((s, idx) => {
        const isOrigin = idx === 0;
        const row = el('a', { class: `stop-row${isOrigin ? ' is-origin' : ''}`, href: `#/stop/${encodeURIComponent(s.stop)}` });
        row.appendChild(el('span', { class: 'stop-idx' }, String(idx + 1)));
        const stopMeta = state.index.lrt.stops.get(s.stop);
        const info = el('div', { class: 'stop-info' });
        info.appendChild(el('div', { class: 'stop-name-row' }, stopMeta ? pickFirst(stopMeta.nameTc, stopMeta.nameEn) : s.stop));
        if (stopMeta && stopMeta.nameEn) info.appendChild(el('div', { class: 'stop-name-en' }, stopMeta.nameEn));
        row.appendChild(info);
        const etaBox = el('div', { class: 'stop-eta' });
        const trains = etaByStop.get(s.stop) || [];
        if (trains.length > 0) {
          const minutes = parseInt(trains[0].time_en, 10);
          if (Number.isFinite(minutes)) {
            etaBox.appendChild(el('span', { class: 'big' + (minutes <= 2 ? ' is-soon' : '') }, `${minutes} ${t_str('minShort')}`));
          } else {
            etaBox.appendChild(el('span', { class: 'big' }, trains[0].time_ch || trains[0].time_en || '–'));
          }
          etaBox.appendChild(el('span', { class: 'small' }, trains.length > 1 ? t_str('etaCount', trains.length - 1) : (trains[0].special ? t_str('scheduled') : '')));
        } else if (idx === 0) {
          etaBox.appendChild(el('span', { class: 'small' }, t_str('loading')));
        } else {
          etaBox.appendChild(el('span', { class: 'small', style: 'color: var(--muted-2);' }, t_str('noEta')));
        }
        row.appendChild(etaBox);
        list.appendChild(row);
      });
      body.replaceChildren(el('h2', { class: 'section-title' }, t_str('showingStop', stopsForDir.length)), list);
    }).catch(() => {
      body.replaceChildren(el('p', { class: 'empty' }, t_str('routeNotFound')));
    });

    startEtaRefresh(renderRouteDetail);
  }

  // ---- Green minibus route ----
  function renderGmbRoute(r) {
    showView('view-route');
    const view = renderInto('route', 'route');
    const header = $('[data-bind="routeHeader"]', view);
    const body = $('[data-bind="routeBody"]', view);
    header.innerHTML = '';
    body.innerHTML = '';

    const meta = state.index.routes.get(makeRouteKey('GMB', r.route, r.dir, r.service));
    const displayRoute = (meta && meta._region && meta._code) ? `${meta._code} (${meta._region})` : r.route;
    if (!meta || !meta._routeId) {
      body.replaceChildren(el('p', { class: 'muted' }, t_str('loadingRoutes')));
      header.appendChild(buildRouteHeader({
        co: 'GMB', route: displayRoute, dir: r.dir || '1', service: r.service,
        dest: r.route, orig: '', origEn: '', dirLabel: '',
        directions: buildDirectionPills('GMB', r.route, r.service, ''),
        currentDirKey: makeRouteKey('GMB', r.route, r.dir || '1', r.service),
      }));
      if (r._region && r._code) {
        fetchGmbRoute(r._region, r._code).then((resp) => {
          const arr = (resp && Array.isArray(resp.data)) ? resp.data : [];
          const found = arr.find((x) => String(x.route_id) === String(r.service));
          if (found) renderGmbRouteAfterMeta(view, header, body, r, found);
        }).catch(() => body.replaceChildren(el('p', { class: 'empty' }, t_str('routeNotFound'))));
      }
      return;
    }
    header.appendChild(buildRouteHeader({
      co: 'GMB', route: displayRoute, dir: r.dir, service: r.service,
      dest: pickFirst(meta.destTc, meta.destEn), orig: pickFirst(meta.origTc, meta.origEn),
      origEn: meta.origEn || '', dirLabel: '', fare: null,
      directions: buildDirectionPills('GMB', r.route, r.service, ''),
      currentDirKey: makeRouteKey('GMB', r.route, r.dir, r.service),
    }));
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    // Fetch stops for the chosen direction.
    fetchGmbRouteStops(meta._routeId, parseInt(r.dir, 10) || 1)
      .then(async (resp) => {
        const stopsRaw = (resp && resp.data && resp.data.route_stops) || [];
        const stops = stopsRaw
          .sort((a, b) => a.stop_seq - b.stop_seq)
          .map((it) => state.index.stops.get(String(it.stop_id)) || { stop: String(it.stop_id), nameTc: it.name_tc, nameEn: it.name_en });
        const firstStops = stops.slice(0, 3);
        const etaResults = await Promise.allSettled(firstStops.map((s) => fetchGmbStopEta(meta._routeId, parseInt(r.dir, 10) || 1, parseInt(s.stop, 10) || 0)));
        const etaByStop = new Map();
        firstStops.forEach((s, i) => {
          const rr = etaResults[i];
          if (rr.status === 'fulfilled' && rr.value && rr.value.data && rr.value.data.eta) {
            etaByStop.set(s.stop, rr.value.data.eta);
          }
        });
        const list = el('div', { class: 'eta-list' });
        stops.forEach((s, idx) => {
          const isOrigin = idx === 0;
          const row = el('a', { class: `stop-row${isOrigin ? ' is-origin' : ''}`, href: `#/stop/${encodeURIComponent(s.stop)}` });
          row.appendChild(el('span', { class: 'stop-idx' }, String(idx + 1)));
          const info = el('div', { class: 'stop-info' });
          info.appendChild(el('div', { class: 'stop-name-row' }, pickFirst(s.nameTc, s.nameEn) || s.stop));
          if (s.nameEn) info.appendChild(el('div', { class: 'stop-name-en' }, s.nameEn));
          row.appendChild(info);
          const etaBox = el('div', { class: 'stop-eta' });
          const etas = etaByStop.get(s.stop) || [];
          if (etas.length > 0) {
            const m = parseInt(etas[0].diff, 10);
            if (Number.isFinite(m)) {
              etaBox.appendChild(el('span', { class: 'big' + (m <= 2 ? ' is-soon' : '') }, `${m} ${t_str('minShort')}`));
            } else {
              etaBox.appendChild(el('span', { class: 'big' }, '–'));
            }
            etaBox.appendChild(el('span', { class: 'small' },
              etas.length > 1 ? t_str('etaCount', etas.length - 1) : (etas[0].remarks_en === 'Scheduled' ? t_str('scheduled') : '')));
          } else if (idx === 0) {
            etaBox.appendChild(el('span', { class: 'small' }, t_str('loading')));
          } else {
            etaBox.appendChild(el('span', { class: 'small', style: 'color: var(--muted-2);' }, t_str('noEta')));
          }
          row.appendChild(etaBox);
          list.appendChild(row);
        });
        body.replaceChildren(el('h2', { class: 'section-title' }, t_str('showingStop', stops.length)), list);
      })
      .catch(() => body.replaceChildren(el('p', { class: 'empty' }, t_str('routeNotFound'))));

    startEtaRefresh(renderRouteDetail);
  }

  function renderGmbRouteAfterMeta(view, header, body, r, found) {
    // Recursive call with corrected service id.
    const dir = (found.directions && found.directions[0] && found.directions[0].route_seq) || 1;
    const dirInfo = (found.directions && found.directions[0]) || {};
    const updated = Object.assign({}, r, {
      service: String(found.route_id),
      dir: String(dir),
      origTc: dirInfo.orig_tc,
      origEn: dirInfo.orig_en,
      destTc: dirInfo.dest_tc,
      destEn: dirInfo.dest_en,
    });
    renderGmbRoute(updated);
  }

  // Render the route header in the justarrived.grok.me style: huge route badge,
  // destination title, origin/operator sub-line, optional fare + English subtitle,
  // and side-by-side direction pills (one filled red, one outlined) so the user
  // can flip inbound/outbound inline.
  function buildRouteHeader(opts) {
    const { co, route, dir, service, dest, orig, origEn, dirLabel, fare, directions, currentKey, currentDirKey, isMapRoute = false } = opts;
    const head = el('div', { class: 'route-header' });

    // ---- top action bar ----
    const topbar = el('div', { class: 'route-topbar' });
    topbar.appendChild(el('a', {
      class: 'route-back',
        'aria-label': t_str('back'),
        href: '#/',
      }, (0, function () {
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

    const topRight = el('div', { class: 'route-topbar-right' });
    const langPill = el('span', { class: 'route-lang-pill' }, state.lang === 'en' ? '繁體中文' : 'English');
    topRight.appendChild(langPill);

    const favKey = { co, route, dir, service };
    const isFav = state.savedRoutes.some((x) => sameRoute(x, favKey));
    const star = el('button', {
      type: 'button',
      class: `route-fav ${isFav ? 'is-fav' : ''}`,
      'aria-label': isFav ? t_str('saved') : t_str('save'),
      'aria-pressed': String(isFav),
      onclick: () => {
        toggleSaveRoute(favKey);
        head.replaceChildren(...buildRouteHeader(opts).childNodes);
      },
    });
    star.appendChild(starIconSVG(isFav));
    topRight.appendChild(star);
    topbar.appendChild(topRight);
    head.appendChild(topbar);

    // ---- main route summary ----
    const summary = el('div', { class: 'route-summary' });
    const numWrap = el('div', { class: 'route-num-wrap' });
    numWrap.appendChild(el('h1', { class: 'route-num' }, route));
    summary.appendChild(numWrap);

    if (co && co !== 'STOP') {
      summary.appendChild(el('span', { class: 'route-op-pill' }, t_str(opCoKey(co))));
    }
    head.appendChild(summary);

    // Destination (large title)
    if (dest) head.appendChild(el('h2', { class: 'route-dest' }, dest));

    // Origin · operator sub-line
    if (orig) {
      const sub = el('p', { class: 'route-sub' });
      const opName = t_str(opCoKey(co));
      sub.appendChild(document.createTextNode(`${orig}${opName ? ' · ' + opName : ''}`));
      head.appendChild(sub);
    }

    // Fare (if available)
    if (fare != null && fare !== '') {
      head.appendChild(el('p', { class: 'route-fare' }, `${t_str('fare')} ${fare}`));
    }

    // English subtitle
    if (origEn) head.appendChild(el('p', { class: 'route-sub-en' }, origEn));

    // ---- direction pills (one filled red, others outlined) ----
    if (Array.isArray(directions) && directions.length > 1) {
      const pills = el('div', { class: 'route-dir-pills', role: 'tablist' });
      for (const d of directions) {
        const isCurrent = (d.key === currentDirKey) || (d.dir === dir && d.service === service);
        const pill = el('a', {
          class: `route-dir-pill ${isCurrent ? 'is-current' : ''}`,
          href: `#/route/${encodeURIComponent(d.co)}/${encodeURIComponent(d.route)}/${encodeURIComponent(d.dir)}/${encodeURIComponent(d.service)}`,
          role: 'tab',
          'aria-selected': String(isCurrent),
        }, d.label);
        pills.appendChild(pill);
      }
      head.appendChild(pills);
    }

    // ---- update indicator + manual refresh ----
    const updated = el('div', { class: 'route-updated' });
    const updateLeft = el('div', { class: 'route-updated-left' });
    updateLeft.appendChild(el('p', { class: 'route-updated-when', 'data-bind': 'route-updated-when' }, t_str('updatedJust')));
    updateLeft.appendChild(el('p', { class: 'route-updated-meta' }, t_str('updatedMeta')));
    updated.appendChild(updateLeft);

    const refreshBtn = el('button', {
      type: 'button',
      class: 'route-refresh',
      'aria-label': t_str('refresh'),
      onclick: () => { if (typeof state._refreshRoute === 'function') state._refreshRoute(); else location.reload(); },
    }, refreshIconSVG());
    updated.appendChild(refreshBtn);
    head.appendChild(updated);

    return head;
  }

  // Filled / outline star SVG for the favorite toggle.
  function starIconSVG(filled) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '22'); svg.setAttribute('height', '22');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.96l-5.9 3.1 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z');
    if (filled) {
      p.setAttribute('fill', 'currentColor');
      p.setAttribute('stroke', 'currentColor');
    } else {
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '1.8');
      p.setAttribute('stroke-linejoin', 'round');
    }
    svg.appendChild(p);
    return svg;
  }

  function refreshIconSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18'); svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    const a = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    a.setAttribute('d', 'M21 12a9 9 0 1 1-3.4-7.05');
    a.setAttribute('fill', 'none'); a.setAttribute('stroke', 'currentColor');
    a.setAttribute('stroke-width', '2'); a.setAttribute('stroke-linecap', 'round');
    svg.appendChild(a);
    const b = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    b.setAttribute('d', 'M21 4v5h-5');
    b.setAttribute('fill', 'none'); b.setAttribute('stroke', 'currentColor');
    b.setAttribute('stroke-width', '2'); b.setAttribute('stroke-linecap', 'round'); b.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(b);
    return svg;
  }

  // Build the list of direction pills for a route header. Scans the index
  // for every entry of the same operator + route (same bound/code/etc.) and
  // returns a sorted, de-duped list of { co, route, dir, service, label }.
  function buildDirectionPills(co, route, service, currentDirLabel) {
    const seen = new Set();
    const out = [];
    const tryAdd = (entry, label) => {
      if (!entry) return;
      const dKey = String(entry.dir);
      const sKey = String(entry.service);
      const key = `${entry.co}|${entry.route}|${dKey}|${sKey}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        co: entry.co, route: entry.route, dir: dKey, service: sKey,
        label: label, key,
      });
    };

    // Search the operator's routes map (KMB / LWB / CTB / NWFB / GMB / LRT).
    if (state.index) {
      const isMtr = co === 'MTR';
      state.index.routes.forEach((entry) => {
        if (entry.co !== co) return;
        if (String(entry.route) !== String(route)) return;
        const label = pickFirst(entry.destTc, entry.destEn) || entry.origTc || '';
        tryAdd(entry, label);
      });
      if (state.index.ctbRoutes) {
        state.index.ctbRoutes.forEach((entry) => {
          if (entry.co !== co) return;
          if (String(entry.route) !== String(route)) return;
          const label = pickFirst(entry.destTc, entry.destEn) || entry.origTc || '';
          tryAdd(entry, label);
        });
      }
      if (state.index.lrt && state.index.lrt.routes) {
        state.index.lrt.routes.forEach((entry) => {
          if (entry.co !== co) return;
          if (String(entry.route) !== String(route)) return;
          const label = pickFirst(entry.destTc, entry.destEn) || '';
          tryAdd(entry, label);
        });
      }
    }
    return out;
  }

  function toggleSaveRoute(r) {
    const i = state.savedRoutes.findIndex((x) => sameRoute(x, r));
    if (i >= 0) { state.savedRoutes.splice(i, 1); toast(t_str('unsave')); }
    else { state.savedRoutes.push(r); toast(t_str('saved')); }
    persist();
    pushRecent({ ...r });
  }

  function renderRouteDetail() {
    if (state.detailRoute) renderRoute(state.detailRoute);
  }

  // ------------------------------------------------------------------
  // Stop detail
  // ------------------------------------------------------------------
  function renderStop(r) {
    state.detailStop = r;
    state.detailRoute = null;
    stopEtaRefresh();

    // Dispatch on co.
    if (r.co === 'MTR') return renderMtrStationView(r.stop);
    if (r.co === 'LRT') return renderLrtStopView(r.stop);
    if (r.co === 'GMB') return renderGmbStopView(r.stop);
    return renderBusStopView(r.stop);
  }

  function renderBusStopView(stopId) {
    showView('view-stop');
    const view = renderInto('stop', 'stop');
    const header = $('[data-bind="stopHeader"]', view);
    const body = $('[data-bind="stopBody"]', view);
    header.innerHTML = '';
    body.innerHTML = '';
    header.appendChild(buildStopHeader(stopId, stopId, '', ''));
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    Promise.all([fetchKmbStop(stopId).catch(() => null), fetchKmbStopEta(stopId).catch(() => null)])
      .then(([stopResp, etaResp]) => {
        const stop = stopResp && stopResp.data ? stopResp.data : { stop: stopId, name_tc: stopId, name_en: '' };
        const data = etaResp && Array.isArray(etaResp.data) ? etaResp.data : [];
        header.replaceChildren(...buildStopHeader(stopId, stop.name_tc, stop.name_en, '').childNodes);

        body.innerHTML = '';

        const groups = new Map();
        data.forEach((e) => {
          if (!e.eta) return;
          const co = classifyKmbOp(e.route, '', e.dest_tc || '');
          const key = makeRouteKey(co, e.route, e.dir, e.service_type);
          if (!groups.has(key)) groups.set(key, { co, route: e.route, dir: e.dir, service: e.service_type, destTc: e.dest_tc, destEn: e.dest_en, etas: [] });
          groups.get(key).etas.push({ eta: e.eta, rmk: e.rmk_en });
        });

        // Compute map once so it survives both the empty-arrivals and the
        // populated-arrivals branches below.
        const mapEl = (() => {
          const meta = state.index.stops.get(stopId);
          if (!meta || !Number.isFinite(meta.lat) || !Number.isFinite(meta.lng)) return null;
          const m = renderStopMap(meta.lat, meta.lng, pickFirst(meta.nameTc, meta.nameEn) || stopId);
          return m.firstChild ? m : null;
        })();

        if (groups.size === 0) {
          body.appendChild(el('p', { class: 'empty' }, t_str('noEta')));
          if (mapEl) body.appendChild(mapEl);
          return;
        }
        const list = el('div', { class: 'list' });
        Array.from(groups.values())
          .sort((a, b) => (minutesUntil(a.etas[0].eta) ?? 999) - (minutesUntil(b.etas[0].eta) ?? 999))
          .forEach((g) => {
            const destStr = pickFirst(g.destTc, g.destEn);
            const row = el('a', {
              class: 'row',
              href: `#/route/${encodeURIComponent(g.co)}/${encodeURIComponent(g.route)}/${encodeURIComponent(g.dir)}/${encodeURIComponent(g.service)}`,
            });
            row.appendChild(makeBadge(g.co));
            const main = el('div', { class: 'row-main' });
            main.appendChild(el('div', { class: 'row-title' }, g.route,
              el('span', { style: 'color: var(--muted); margin: 0 6px; font-weight: 500;' }, '·'),
              destStr));
            main.appendChild(el('div', { class: 'row-sub' }, g.dir === 'I' ? t_str('inbound') : t_str('outbound')));
            row.appendChild(main);
            const meta = el('div', { class: 'row-meta' });
            meta.appendChild(etaSpan(g.etas[0].eta));
            if (g.etas.length > 1) meta.appendChild(el('div', { class: 'row-dim' }, t_str('etaCount', g.etas.length - 1)));
            row.appendChild(meta);
            row.appendChild(makeChev());
            list.appendChild(row);
          });
        body.replaceChildren(list);
        // Map at the bottom of the page, just like justarrived.grok.me.
        if (mapEl) body.appendChild(mapEl);
      });

    startEtaRefresh(renderStopDetail);
  }

  // ---- MTR station stop view (same as renderMtrStationRoute, but reachable directly) ----
  function renderMtrStationView(stationCode) {
    return renderMtrStationRoute({ co: 'MTR', route: stationCode, dir: 'STATION', service: '' });
  }

  // ---- LRT stop view ----
  function renderLrtStopView(stopCode) {
    showView('view-stop');
    const view = renderInto('stop', 'stop');
    const header = $('[data-bind="stopHeader"]', view);
    const body = $('[data-bind="stopBody"]', view);
    header.innerHTML = '';
    body.innerHTML = '';
    const stop = state.index.lrt.stops.get(stopCode);
    const nameTc = stop ? stop.nameTc : stopCode;
    const nameEn = stop ? stop.nameEn : '';
    header.appendChild(buildStopHeader(stopCode, nameTc, nameEn, 'LRT'));
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    const stationId = stop && stop.id ? stop.id : null;
    if (!stationId) {
      body.replaceChildren(el('p', { class: 'empty' }, t_str('stopNotFound')));
      return;
    }

    // LRT stops currently lack WGS84 coords in the official sources. The
    // map section is only rendered when we actually have lat/lng.

    fetchLrtSchedule(stationId).then((resp) => {
      if (!resp || !Array.isArray(resp.platform_list)) {
        body.replaceChildren(el('p', { class: 'empty' }, t_str('noEta')));
        return;
      }
      const wrap = el('div', { class: 'eta-list-wrap' });
      resp.platform_list.forEach((p) => {
        const heading = el('div', { class: 'eta-dir' }, `${t_str('platform')} ${p.platform_id}`);
        wrap.appendChild(heading);
        const list = el('div', { class: 'list' });
        (p.route_list || []).forEach((tr) => {
          const row = el('a', {
            class: 'row',
            href: `#/route/LRT/${encodeURIComponent(tr.route_no)}/1/${encodeURIComponent(stopCode)}`,
          });
          row.appendChild(makeBadge('LRT'));
          const main = el('div', { class: 'row-main' });
          main.appendChild(el('div', { class: 'row-title' }, tr.route_no,
            el('span', { style: 'color: var(--muted); margin: 0 6px; font-weight: 500;' }, '·'),
            tr.dest_ch || tr.dest_en || ''));
          const min = parseInt(tr.time_en, 10);
          main.appendChild(el('div', { class: 'row-sub' }, tr.special ? t_str('scheduled') : ''));
          row.appendChild(main);
          const meta = el('div', { class: 'row-meta' });
          if (Number.isFinite(min)) {
            meta.appendChild(el('span', { class: 'row-eta' + (min <= 2 ? ' is-soon' : '') }, `${min} ${t_str('minShort')}`));
          } else {
            meta.appendChild(el('span', { class: 'row-eta' }, tr.time_ch || tr.time_en || '–'));
          }
          row.appendChild(meta);
          row.appendChild(makeChev());
          list.appendChild(row);
        });
        wrap.appendChild(list);
      });
      body.replaceChildren(wrap);
    }).catch(() => body.replaceChildren(el('p', { class: 'empty' }, t_str('noEta'))));

    startEtaRefresh(renderStopDetail);
  }

  // ---- GMB stop view (routes serving this stop) ----
  function renderGmbStopView(stopId) {
    showView('view-stop');
    const view = renderInto('stop', 'stop');
    const header = $('[data-bind="stopHeader"]', view);
    const body = $('[data-bind="stopBody"]', view);
    header.innerHTML = '';
    body.innerHTML = '';
    header.appendChild(buildStopHeader(stopId, stopId, '', 'GMB'));
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    // Try to enrich the stop with a real name + coordinates.
    primeGmbStopCoord(stopId).then((meta) => {
      if (meta) header.replaceChildren(...buildStopHeader(stopId, meta.nameTc || stopId, meta.nameEn || '', 'GMB').childNodes);
      // Stash for the map append after the routes list renders.
      state._lastGmbStopMeta = meta || null;
    });

    fetchGmbStopRoutes(stopId).then(async (resp) => {
      const list = (resp && Array.isArray(resp.data)) ? resp.data : [];
      if (list.length === 0) {
        body.replaceChildren(el('p', { class: 'empty' }, t_str('noEta')));
        return;
      }
      // Fetch ETA per route×stop_seq for first route only, then show others as "schedule only".
      const rows = [];
      for (const r of list) {
        rows.push({
          routeId: r.route_id, routeSeq: r.route_seq, stopSeq: r.stop_seq, name: r.name_tc,
          _routeSeqStop: `${r.route_seq}_${r.stop_seq}`,
        });
      }
      // Take the first route, get its current/next, leave the rest as info-only.
      const head = rows[0];
      let etaInfo = null;
      try {
        const etaResp = await fetchGmbStopEta(head.routeId, head.routeSeq, head.stopSeq);
        if (etaResp && etaResp.data && etaResp.data.eta && etaResp.data.eta[0]) {
          etaInfo = etaResp.data.eta[0];
        }
      } catch {}

      const wrap = el('div');
      wrap.appendChild(el('h2', { class: 'section-title' }, t_str('showingStop', list.length)));
      const ul = el('div', { class: 'list' });
      rows.forEach((row) => {
        const li = el('div', { class: 'row' });
        li.appendChild(makeBadge('GMB'));
        const main = el('div', { class: 'row-main' });
        main.appendChild(el('div', { class: 'row-title' }, row.name || ''));
        main.appendChild(el('div', { class: 'row-sub' }, `${t_str('route')} #${row.routeId}`));
        li.appendChild(main);
        li.appendChild(el('div', { class: 'row-meta' },
          row === head && etaInfo
            ? el('span', { class: 'row-eta' }, `${etaInfo.diff} ${t_str('minShort')}`)
            : el('div', { class: 'row-dim' }, t_str('scheduled'))));
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
      body.replaceChildren(wrap);
      // Append the map at the bottom (justarrived.grok.me pattern).
      const meta = state._lastGmbStopMeta;
      state._lastGmbStopMeta = null;
      if (meta && Number.isFinite(meta.lat) && Number.isFinite(meta.lng)) {
        const mapEl = renderStopMap(meta.lat, meta.lng, pickFirst(meta.nameTc, meta.nameEn) || stopId);
        if (mapEl.firstChild) body.appendChild(mapEl);
      }
    }).catch(() => body.replaceChildren(el('p', { class: 'empty' }, t_str('noEta'))));

    startEtaRefresh(renderStopDetail);
  }

  function buildStopHeader(stopId, nameTc, nameEn, co) {
    const head = el('div', { class: 'stop-header' });
    head.appendChild(el('div', { class: 'stop-name' }, pickFirst(nameTc, nameEn) || stopId));
    if (nameEn) head.appendChild(el('div', { class: 'stop-name-en' }, nameEn));
    const actions = el('div', { class: 'stop-actions' });
    const isFav = state.savedStops.some((s) => sameStop(s, { stop: stopId }));
    actions.appendChild(el('button', {
      class: 'btn-secondary', type: 'button',
      onclick: () => {
        toggleSaveStop({ stop: stopId });
        head.replaceChildren(...buildStopHeader(stopId, nameTc, nameEn, co).childNodes);
      },
    }, isFav ? t_str('saved') : t_str('save')));
    head.appendChild(actions);
    return head;
  }

  function toggleSaveStop(s) {
    const i = state.savedStops.findIndex((x) => sameStop(x, s));
    if (i >= 0) { state.savedStops.splice(i, 1); toast(t_str('unsave')); }
    else { state.savedStops.push(s); toast(t_str('saved')); }
    persist();
    pushRecent({ ...s });
  }

  function renderStopDetail() {
    if (state.detailStop) renderStop(state.detailStop);
  }

  // ------------------------------------------------------------------
  // Error view
  // ------------------------------------------------------------------
  function renderError() {
    showView('view-error');
    const view = renderInto('error', 'error');
    const btn = $('#errorRetry', view);
    btn.addEventListener('click', () => { location.hash = '#/'; });
  }

  // ------------------------------------------------------------------
  // Recent
  // ------------------------------------------------------------------
  function pushRecent(item) {
    const key = item.stop
      ? JSON.stringify({ stop: item.stop, co: item.co || 'STOP' })
      : JSON.stringify(makeRouteKey(item.co, item.route, item.dir, item.service));
    state.recent = [item, ...state.recent.filter((x) => {
      const k = x.stop
        ? JSON.stringify({ stop: x.stop, co: x.co || 'STOP' })
        : JSON.stringify(makeRouteKey(x.co, x.route, x.dir, x.service));
      return k !== key;
    })].slice(0, 20);
    persist();
  }

  // ------------------------------------------------------------------
  // Auto-refresh
  // ------------------------------------------------------------------
  function startEtaRefresh(fn) {
    clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => {
      fn();
      updateRouteTimestamp();
    }, REFRESH_INTERVAL_MS);
    updateRouteTimestamp();
  }
  function updateRouteTimestamp() {
    const el2 = document.querySelector('[data-bind="route-updated-when"]');
    if (!el2) return;
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    el2.textContent = `${t_str('updatedJust')} · ${hh}:${mm}`;
  }
  function stopEtaRefresh() {
    if (state.refreshTimer) { clearInterval(state.refreshTimer); state.refreshTimer = null; }
  }

  // ------------------------------------------------------------------
  // Clock
  // ------------------------------------------------------------------
  function updateClock() {
    const c = document.getElementById('clock');
    if (!c) return;
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    c.textContent = `${hh}:${mm}`;
  }

  // ------------------------------------------------------------------
  // Toast
  // ------------------------------------------------------------------
  let toastTimer = null;
  function toast(msg) {
    let node = document.querySelector('.toast');
    if (!node) {
      node = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(node);
    }
    node.textContent = msg;
    requestAnimationFrame(() => node.classList.add('is-on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('is-on'), 1800);
  }

  // ------------------------------------------------------------------
  // Language
  // ------------------------------------------------------------------
  function applyLang() {
    document.documentElement.lang = state.lang === 'en' ? 'en' : 'zh-Hant';
    applyI18n(document.body);
  }
  function toggleLang() {
    state.lang = state.lang === 'zh-Hant' ? 'en' : 'zh-Hant';
    persist();
    applyLang();
    onHashChange();
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  async function boot() {
    loadState();
    applyLang();
    updateClock();
    setInterval(updateClock, 30_000);

    document.getElementById('langToggle').addEventListener('click', toggleLang);
    window.addEventListener('hashchange', onHashChange);

    // Best-effort: load any site-wide config (e.g. the Google Maps API key)
    // before rendering so the embedded map is ready on first visit.
    await loadGmapsConfig().catch(() => {});

    try {
      await loadIndex();
    } catch (err) {
      console.error('Index build failed', err);
    }

    if (!location.hash) location.hash = '#/';
    onHashChange();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();