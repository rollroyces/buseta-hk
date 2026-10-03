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
      geoBannerTitle: '想睇附近嘅車站同路線？',
      geoBannerBody: '授權使用你嘅位置，我哋會列出最近嘅巴士站、港鐵站同常見路線，仲可以幫你直接跳到最近嗰個車站。',
      geoBannerCta: '啟用位置',
      nearestStopLabel: '最近車站',
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
      nextArrivals: '下一班到站',
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
      schoolTag: 'school',
      schoolTagTitle: '此路線另有上學日特別班次',
      gmapsKeyCleared: '已清除',
      clearKey: '清除',
      fare: '車費',
      updatedJust: '剛剛更新',
      updatedMeta: '到站時間每分鐘更新',
      refresh: '更新',
      ctbNoEtaHint: '請打開個別路線嘅詳情睇實時到站。',
      tabLive: '即時',
      tabLiveEn: 'Live',
      tabSchedule: '時間表',
      tabScheduleEn: 'Schedule',
      loadingSchedule: '載入時間表中…',
      scheduleEmpty: '時間表未有資料。',
      scheduleNote: '以下係由各營辦商公開數據提供嘅預定到站時間，每日約 05:00 更新。',
      scheduleHour: (h) => `${h}:00`,
      lastBusAlert: '尾班車已過，今日已無下一班',
      affectedServices: (n) => `${n} 班次受影響`,
      noServiceAlert: '暫無班次',
      dismissAlert: '關閉通知',
      navPlanner: '行程',
      plannerTitle: '行程規劃',
      plannerSubtitle: '輸入起點同終點，搵直車或者轉車嘅最快路線。',
      plannerFrom: '起點',
      plannerTo: '終點',
      plannerFromPh: '輸入車站、港鐵站或地點',
      plannerToPh: '輸入車站、港鐵站或地點',
      plannerSwap: '對調',
      plannerGo: '搵路線',
      plannerSearching: '搵緊路線…',
      plannerWalk: '步行',
      plannerRide: '乘車',
      plannerTransfers: '轉乘',
      plannerBest: '最快',
      plannerBestLabel: '最快嘅建議',
      plannerDirect: '直達',
      plannerDirectCount: (n) => `搵到 ${n} 個直達方案`,
      plannerNoDirect: '冇直達路線，需要轉車。',
      planner1Hop: '轉一次車',
      planner2Hop: '轉兩次車',
      plannerBoard: '乘搭',
      plannerArrive: '預計到達',
      plannerNoStops: '請先輸入起點同終點。',
      plannerNoResults: '暫時搵唔到合適嘅路線，試吓其他車站啦。',
      plannerSameStop: '起點同終點係同一個車站。',
      plannerError: '規劃時出咗啲問題，再試一次啦。',
      plannerRecent: '最近嘅行程',
      plannerRecentEmpty: '未有最近嘅行程。',
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
      geoBannerTitle: 'See nearby stops and routes?',
      geoBannerBody: 'Allow location access to list the closest bus stops, MTR stations and frequent routes — and jump straight to the nearest stop.',
      geoBannerCta: 'Use my location',
      nearestStopLabel: 'Nearest stop',
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
      nextArrivals: 'Next arrivals',
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
      schoolTag: 'school',
      schoolTagTitle: 'This route also runs school-day special trips',
      gmapsKeyCleared: 'Cleared',
      clearKey: 'Clear',
      fare: 'Fare',
      updatedJust: 'Just updated',
      updatedMeta: 'Live arrivals refresh every minute',
      refresh: 'Refresh',
      ctbNoEtaHint: 'Open a route to see live arrivals for this stop.',
      tabLive: 'Live',
      tabLiveEn: '即時',
      tabSchedule: 'Schedule',
      tabScheduleEn: '時間表',
      loadingSchedule: 'Loading timetable…',
      scheduleEmpty: 'No timetable data available.',
      scheduleNote: 'Scheduled arrival times from operator open-data feeds (updated around 05:00 daily).',
      scheduleHour: (h) => `${h}:00`,
      lastBusAlert: 'Last bus has departed — no more services today',
      affectedServices: (n) => `${n} services affected`,
      noServiceAlert: 'No service running',
      dismissAlert: 'Dismiss',
      navPlanner: 'Planner',
      plannerTitle: 'Trip planner',
      plannerSubtitle: 'Enter your origin and destination — find the fastest direct route or a quick transfer.',
      plannerFrom: 'From',
      plannerTo: 'To',
      plannerFromPh: 'Stop, station or place',
      plannerToPh: 'Stop, station or place',
      plannerSwap: 'Swap',
      plannerGo: 'Find route',
      plannerSearching: 'Searching…',
      plannerWalk: 'Walk',
      plannerRide: 'Ride',
      plannerTransfers: 'Transfers',
      plannerBest: 'Fastest',
      plannerBestLabel: 'Fastest option',
      plannerDirect: 'Direct',
      plannerDirectCount: (n) => `${n} direct option${n === 1 ? '' : 's'}`,
      plannerNoDirect: 'No direct routes — transfers required.',
      planner1Hop: '1 transfer',
      planner2Hop: '2 transfers',
      plannerBoard: 'Board',
      plannerArrive: 'Arrive',
      plannerNoStops: 'Please enter both an origin and a destination.',
      plannerNoResults: 'No matching routes. Try different stops.',
      plannerSameStop: 'Origin and destination are the same stop.',
      plannerError: 'Something went wrong. Please try again.',
      plannerRecent: 'Recent trips',
      plannerRecentEmpty: 'No recent trips yet.',
    },
    'zh-Hans': {
      brandSub: '香港巴士',
      tagline: '实时到站',
      loading: '载入紧资料…',
      navHome: '主页',
      navSearch: '搜寻',
      langOther: 'English',
      savedRoutes: '收藏路线',
      savedStops: '收藏车站',
      recentSearches: '最近查过',
      operatorsTitle: '支援交通工具',
      operatorsNote: '独立第三方应用。资料由各营办商透过运输署公开数据提供。',
      emptyRoutes: '未有收藏路线。',
      emptyStops: '未有收藏车站。',
      emptyRecent: '未有最近查过嘅路线。',
      footerAttribution: '资料来源：运输署资料一线通。到站时间嚟自九巴、龙运、城巴、专线小巴及港铁（包括轻铁）；车费嚟自公共交通路线及收费资料。预计时间约每分钟更新，只供参考。',
      searchPlaceholder: '路线、地点、车站或港铁站',
      filterAll: '全部',
      filterKMB: '九巴',
      filterLWB: '龙运',
      filterCTB: '城巴',
      filterGMB: '小巴',
      filterMTR: '港铁',
      dirUp: '上行',
      dirDown: '下行',
      inbound: '去程',
      outbound: '回程',
      line: '路线',
      platform: '月台',
      noFavHint: '搜寻后可以加入收藏，方便日後对咭查阅。',
      save: '收藏',
      saved: '已收藏',
      unsave: '取消收藏',
      minShort: '分',
      arriving: '即将到站',
      scheduled: '原定班次',
      lastBus: '尾班车',
      lastTrain: '尾班车',
      noEta: '暂无到站时间',
      nextArrivals: '下一班到站',
      etaCount: (n) => `仲有 ${n} 班`,
      errorTitle: '揫唔到呢页',
      errorBody: '你跟蹤嘅连结可能已经过期，或者资料未能成功载入。',
      retry: '再试一次',
      showingStop: (n) => `全线 ${n} 站`,
      enName: '英文名',
      kmb: '九巴',
      lwb: '龙运',
      ctb: '城巴',
      nwfb: '新巴',
      gmb: '专线小巴',
      mtr: '港铁',
      lrt: '轻铁',
      routeNotFound: '揫唔到呢条路线。',
      stopNotFound: '揫唔到呢个车站。',
      noNearbyRoutes: '附近范围未有常见路线。',
      noNearbyStops: '附近范围未有常见车站。',
      noNearbyStations: '附近范围未有港铁站。',
      searchHint: '输入路线编号、车站名或港铁站',
      clearRecent: '清除记录',
      cleared: '已清除',
      toStop: '去呢个车站',
      toRoute: '睇路线详情',
      allLines: '全部路线',
      selectStation: '揾该站',
      loadingRoutes: '揾紧小巴路线…',
      gmbProgress: (done, total) => `已载入 ${done}/${total} 条小巴路线`,
      fetchFailed: '载入唔到，揫一下。',
      openInMaps: '喺 Google Maps 开启',
      mapHeader: '地图',
      settingsTitle: '设定',
      gmapsKeyLabel: 'Google Maps API key',
      gmapsKeyHint: '用 Google Maps Embed API 嘅 key（网站 HTTP referrer 已限制）。留空就会用连结去 Google Maps 而唔系内嵌地图。',
      gmapsKeySave: '储存',
      gmapsKeySaved: '已储存',
      schoolTag: 'school',
      schoolTagTitle: '此路线另有上学日特别班次',
      gmapsKeyCleared: '已清除',
      clearKey: '清除',
      fare: '车费',
      updatedJust: '啁啁更新',
      updatedMeta: '到站时间每分钟更新',
      refresh: '更新',
      ctbNoEtaHint: '请打开个别路线嘅详情睇实时到站。',
      tabLive: '实时',
      tabLiveEn: 'Live',
      tabSchedule: '时间表',
      tabScheduleEn: 'Schedule',
      loadingSchedule: '载入时间表中…',
      scheduleEmpty: '时间表未有资料。',
      scheduleNote: '以下系由各营办商公开数据提供嘅预定到站时间，每日约 05:00 更新。',
      scheduleHour: (h) => `${h}:00`,
      lastBusAlert: '尾班车已过，今日已无下一班',
      affectedServices: (n) => `${n} 班次受影响`,
      noServiceAlert: '暂无班次',
      dismissAlert: '关闭通知',
      geoBannerTitle: '想睇附近嘅车站同路线？',
      geoBannerBody: '授权使用你嘅位置，我哋会列出最近嘅巴士站、港铁站同常见路线，仲可以帮你直接跳到最近嗰个车站。',
      geoBannerCta: '启用位置',
      nearestStopLabel: '最近车站',
      navPlanner: '行程',
      plannerTitle: '行程规划',
      plannerSubtitle: '输入起点同终点，搵直车或者转车嘅最快路线。',
      plannerFrom: '起点',
      plannerTo: '终点',
      plannerFromPh: '输入车站、港铁站或地点',
      plannerToPh: '输入车站、港铁站或地点',
      plannerSwap: '对调',
      plannerGo: '搵路线',
      plannerSearching: '搵紧路线…',
      plannerWalk: '步行',
      plannerRide: '乘车',
      plannerTransfers: '转乘',
      plannerBest: '最快',
      plannerBestLabel: '最快嘅建议',
      plannerDirect: '直达',
      plannerDirectCount: (n) => `搵到 ${n} 个直达方案`,
      plannerNoDirect: '冇直达路线，需要转车。',
      planner1Hop: '转一次车',
      planner2Hop: '转两次车',
      plannerBoard: '乘搭',
      plannerArrive: '预计到达',
      plannerNoStops: '请先输入起点同终点。',
      plannerNoResults: '暂时搵唔到合适嘅路线，试下其他车站啦。',
      plannerSameStop: '起点同终点系同一个车站。',
      plannerError: '规划时出咗啲问题，再试一次啦。',
      plannerRecent: '最近嘅行程',
      plannerRecentEmpty: '未有最近嘅行程。',
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
  // Module-level caches
  // ------------------------------------------------------------------
  // Per-stop schedule cache. The schedule view reuses these so re-visits
  // are instant without re-hitting the operator APIs.
  const scheduleCache = new Map();

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
    userLoc: null,
    locationStatus: 'idle',
    _geoAsked: false,
    refreshTimer: null,
    lastSearchQ: '',
    filter: 'ALL',
    detailRoute: null,
    detailStop: null,
    gmapsKey: '',
    gmapsConfigLoaded: false,
    // In-memory only: alert banners the user has dismissed this session.
    // Keyed by route + alert type so different routes / different alerts are
    // tracked independently. Cleared on full page reload (intentional —
    // spec says dismissals do not persist across visits).
    dismissedAlerts: new Set(),
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

  // Pick a stop / route name in the current UI language. Falls back to the
  // other Chinese variant (tc ↔ sc) if the requested variant is empty, then
  // to English. Operator APIs return `name_tc` / `name_sc` / `name_en`.
  function pickName(obj, lang) {
    if (!obj) return '';
    const wantTc = lang !== 'zh-Hans';
    const tc = obj.name_tc || obj.nameTc || '';
    const sc = obj.name_sc || obj.nameSc || '';
    const en = obj.name_en || obj.nameEn || '';
    if (lang === 'en') return en || tc || sc;
    if (wantTc) return tc || sc || en;
    return sc || tc || en;
  }

  // Convenience: pick a stop / route name in the *current* UI language.
  // Wraps `pickName(obj, state.lang)` for the common case.
  function nameFor(obj) { return pickName(obj, state.lang); }

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
          stop: s.stop,
          nameTc: s.name_tc, nameSc: s.name_sc || '', nameEn: s.name_en,
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

  // Citybus + NWFB (CTB uses 6-digit numeric stop IDs)
  const fetchCitybusRouteStop = (route, dir) =>
    fetchJSON(`${API.CITYBUS}/route-stop/ctb/${encodeURIComponent(route)}/${dir === 'I' ? 'inbound' : 'outbound'}`);
  const fetchCitybusStopEta = (stopId, route) =>
    fetchJSON(`${API.CITYBUS}/eta/ctb/${encodeURIComponent(stopId)}/${encodeURIComponent(route)}`);
  // CTB stop metadata (name includes "Stop, Location" for many stops).
  const fetchCitybusStop = (stopId) =>
    fetchJSON(`${API.CITYBUS}/stop/${encodeURIComponent(stopId)}`);
  // Per-stop ETA feed (CTB uses 6-digit numeric stop IDs).
  const fetchCitybusBatchStopEta = (stopId) =>
    fetchJSON(`https://rt.data.gov.hk/v1/transport/batch/stop-eta/CTB/${encodeURIComponent(stopId)}`);
  // Returns the right ETA fetcher for a stop_id + route + dir.
  function fetchEtaForStop(stopId, route, dir) {
    if (typeof stopId === 'string' && /^[0-9a-fA-F]{16}$/.test(stopId)) return fetchKmbStopEta(stopId);
    if (typeof stopId === 'string' && /^[0-9]{6}$/.test(stopId)) return fetchCitybusStopEta(stopId, route);
    // Generic KMB route-stop lookup works for any operator's KMB-format stop.
    return fetchKmbStopEta(stopId);
  }

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

  // Module-level cache for stop coords fetched from operator endpoints.
  // Keyed by `${operator}|${stopId}` so CTB and KMB stop IDs don't collide.
  // Multiple routes share stops (CTB 680 ↔ 680A, KMB 1 ↔ 1A …) so caching
  // here saves repeat fetches when the user jumps between routes.
  const stopCoordCache = new Map();
  async function ensureStopCoords(stopId, isCitybus) {
    const op = isCitybus ? 'CTB' : 'KMB';
    const key = `${op}|${stopId}`;
    if (stopCoordCache.has(key)) return stopCoordCache.get(key);
    const fetcher = isCitybus ? fetchCitybusStop : fetchKmbStop;
    try {
      const resp = await fetcher(stopId);
      const d = resp && resp.data;
      const obj = Array.isArray(d) ? d[0] : d;
      const lat = Number(obj && obj.lat);
      const lng = Number(obj && (obj.long || obj.lng));
      const out = (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
      stopCoordCache.set(key, out);
      return out;
    } catch {
      stopCoordCache.set(key, null);
      return null;
    }
  }

  // Render the route-level polyline map. Pure SVG — no Leaflet/Mapbox/
  // Google Maps JS dependency. Takes the resolved stop list and a
  // `coordByStop` Map<stopId, {lat,lng}>; returns a section Node, or null
  // if fewer than two stops have coords (caller should then skip rendering).
  function renderRoutePolyline(stops, coordByStop) {
    if (!stops || stops.length === 0) return null;
    const points = [];
    stops.forEach((s, i) => {
      const c = coordByStop.get(s.stop);
      if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
        points.push({ idx: i, lat: c.lat, lng: c.lng });
      }
    });
    if (points.length < 2) return null;

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    points.forEach(({ lat, lng }) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });
    const spanLat = maxLat - minLat || 0.01;
    const spanLng = maxLng - minLng || 0.01;
    const padLat = spanLat * 0.08;
    const padLng = spanLng * 0.08;
    const W = 1000, H = 360;
    const project = (lat, lng) => {
      const x = ((lng - (minLng - padLng)) / (spanLng + padLng * 2)) * W;
      // Flip Y because SVG origin is top-left and latitude grows upward.
      const y = ((maxLat + padLat - lat) / (spanLat + padLng * 2)) * H;
      return [x, y];
    };

    const NS = 'http://www.w3.org/2000/svg';
    const section = el('section', { class: 'route-map', 'aria-label': t_str('mapHeader') });
    const head = el('div', { class: 'route-map-head' },
      el('span', { class: 'route-map-title' }, t_str('mapHeader')),
      el('span', { class: 'route-map-meta' }, `${points.length}/${stops.length}`),
    );
    section.appendChild(head);

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'route-map-svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');

    const lineD = points.map(({ lat, lng }, i) => {
      const [x, y] = project(lat, lng);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', lineD);
    path.setAttribute('class', 'route-map-line');
    svg.appendChild(path);

    points.forEach((p, i) => {
      const [x, y] = project(p.lat, p.lng);
      const isOrigin = i === 0;
      const isTarget = i === points.length - 1;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x.toFixed(1));
      c.setAttribute('cy', y.toFixed(1));
      c.setAttribute('r', isOrigin || isTarget ? '5.5' : '3.5');
      const cls = ['route-map-stop'];
      if (isOrigin) cls.push('is-origin');
      if (isTarget) cls.push('is-target');
      c.setAttribute('class', cls.join(' '));
      svg.appendChild(c);
    });

    const frame = el('div', { class: 'route-map-frame' });
    frame.appendChild(svg);
    section.appendChild(frame);
    return section;
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
      const out = state.index.stops.get(stopId) || { stop: stopId, nameTc: '', nameSc: '', nameEn: '' };
      out.lat = lat; out.lng = lng;
      if (data.name_tc && !out.nameTc) out.nameTc = data.name_tc;
      if (data.name_sc && !out.nameSc) out.nameSc = data.name_sc;
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
  // Banner-triggered single-shot request for the user's location.
  // Must be invoked from a user gesture (click handler) so the browser
  // will surface the native permission prompt. We never call this
  // automatically on page load — instead the home view shows an
  // in-page banner that the user taps to opt in.
  function requestLocation() {
    if (state.locationStatus === 'pending' || state.locationStatus === 'ok') return;
    if (!navigator.geolocation) {
      state.locationStatus = 'unavailable';
      state._geoAsked = true;
      toast(t_str('locationUnavailable'));
      rerenderLocationViews();
      return;
    }
    state.locationStatus = 'pending';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        state.userLoc = state.location;
        state.locationStatus = 'ok';
        rerenderLocationViews();
      },
      (err) => {
        state.locationStatus = err && err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable';
        state._geoAsked = true;
        rerenderLocationViews();
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 }
    );
  }

  // Re-render whichever views depend on the user's location, so the
  // banner disappears / nearby sections populate after a permission
  // decision without forcing the user to leave the page.
  function rerenderLocationViews() {
    const view = currentRoute();
    if (view === 'home') renderHome();
    else if (view === 'search') renderSearch();
  }

  // ------------------------------------------------------------------
  // Routing
  // ------------------------------------------------------------------
  function parseHash() {
    const h = location.hash.replace(/^#/, '') || '/';
    if (h === '/' || h === '') return { view: 'home' };
    if (h === '/search') return { view: 'search' };
    if (h === '/planner') return { view: 'planner' };
    // /route/<co>/<route>/<dir>/<service>[/<stop_seq>]
    let m = h.match(/^\/route\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/);
    if (m) {
      return {
        view: 'route',
        co: decodeURIComponent(m[1]),
        route: decodeURIComponent(m[2]),
        dir: decodeURIComponent(m[3]),
        service: decodeURIComponent(m[4]),
        stopSeq: m[5] ? decodeURIComponent(m[5]) : null,
      };
    }
    m = h.match(/^\/stop\/(.+)$/);
    if (m) return { view: 'stop', stop: decodeURIComponent(m[1]) };
    return { view: 'error' };
  }
  function currentRoute() { return parseHash().view; }

  function showView(name) {
    ['splash', 'view-home', 'view-search', 'view-route', 'view-stop', 'view-error', 'view-planner']
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
    else if (r.view === 'planner') active = 'planner';
    else if (r.view === 'home') active = 'home';
    else if (r.view === 'route' || r.view === 'stop') active = 'home';
    $$('.nav-item').forEach((n) => n.classList.toggle('is-active', n.dataset.route === active));

    // Hide splash once we navigate
    const splash = document.getElementById('splash');
    if (splash && !splash.hidden) splash.hidden = true;

    switch (r.view) {
      case 'home': renderHome(); break;
      case 'search': renderSearch(); break;
      case 'planner': renderPlannerView(); break;
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
    const container = view.querySelector('.container') || view;

    // Pre-fill / banner zone: at the top of the home view we either show
    // the in-page location permission banner (no permission yet) OR the
    // nearest-stop pill (permission granted). Hidden on denial.
    if (shouldShowGeoBanner()) {
      container.insertBefore(buildGeoBanner(), container.firstChild);
    } else if (state.userLoc) {
      const pill = buildNearestStopPill();
      if (pill) container.insertBefore(pill, container.firstChild);
    }

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
        if (r.stop) {
          ul.appendChild(stopRow({ stop: r.stop, co: r.co }));
        } else if (r.route) {
          // Hydrate the recent item with the current route meta (dest/orig
          // are not stored in localStorage — look them up from the index so
          // the row shows a useful destination instead of an empty string).
          const meta = (state.index && (state.index.routes.get(makeRouteKey(r.co, r.route, r.dir, r.service))
            || state.index.ctbRoutes.get(makeRouteKey(r.co, r.route, r.dir, r.service))))
            || null;
          ul.appendChild(routeRow({
            co: r.co,
            route: r.route,
            dir: r.dir,
            service: r.service,
            destTc: meta ? meta.destTc : '',
            destEn: meta ? meta.destEn : '',
            origTc: meta ? meta.origTc : '',
            origEn: meta ? meta.origEn : '',
          }));
        }
      });
      recentEl.appendChild(ul);
      recentEl.appendChild(el('button', {
        class: 'btn-secondary', style: 'margin-top: 12px; color: var(--ink); background: var(--bg-soft);',
        onclick: () => { state.recent = []; persist(); renderHome(); toast(t_str('cleared')); },
      }, t_str('clearRecent')));
    }

    // Nearby sections: only rendered when location is known. Insert the
    // bind containers into the home template and let populateNearbyInto
    // fill them in (same code path as the search view).
    if (state.userLoc) {
      const opsStrip = view.querySelector('.operators-strip');
      const anchor = (opsStrip && opsStrip.parentNode === container)
        ? opsStrip.nextSibling
        : container.firstChild;

      const nearbyStopsBlock = el('div', { 'data-bind': 'nearbyStops' });
      nearbyStopsBlock.appendChild(el('h2', { class: 'section-title' }, t_str('nearbyStops')));
      const nearbyRoutesBlock = el('div', { 'data-bind': 'nearbyRoutes' });
      nearbyRoutesBlock.appendChild(el('h2', { class: 'section-title' }, t_str('nearbyRoutes')));
      const nearbyStationsBlock = el('div', { 'data-bind': 'nearbyStations' });
      nearbyStationsBlock.appendChild(el('h2', { class: 'section-title' }, t_str('nearbyStations')));

      // Insert before the savedRoutes section (operators strip is at top,
      // savedRoutes heading is right after it).
      const savedRoutesHeading = container.querySelector('[data-bind="savedRoutes"]');
      const insertAnchor = savedRoutesHeading
        ? savedRoutesHeading.previousElementSibling // the <h2> "收藏路線"
        : anchor;
      // We insert in order: stations, routes, stops (matches search view).
      container.insertBefore(nearbyStationsBlock, insertAnchor);
      container.insertBefore(nearbyRoutesBlock, insertAnchor);
      container.insertBefore(nearbyStopsBlock, insertAnchor);

      populateNearbyInto(view);
    }
  }

  // ------------------------------------------------------------------
  // Search
  // ------------------------------------------------------------------
  function renderSearch() {
    showView('view-search');
    const view = renderInto('search', 'search');

    // No auto-prompt: show the in-page permission banner at the top so the
    // user can opt in via a click instead of getting a native dialog.
    if (shouldShowGeoBanner()) {
      const container = view.querySelector('.container') || view;
      container.insertBefore(buildGeoBanner(), container.firstChild);
    }

    const input = $('#searchInput', view);
    // Pre-fill the search box with the nearest stop name when location is
    // granted and the field isn't already populated from a previous visit.
    // Auto-fill only — we don't navigate; the user still taps search.
    if (!state.lastSearchQ && state.userLoc && state.index) {
      const nearest = Array.from(state.index.stops.values())
        .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
        .map((s) => ({ s, d: haversine(state.userLoc.lat, state.userLoc.lng, s.lat, s.lng) }))
        .sort((a, b) => a.d - b.d)[0];
      if (nearest) {
        const name = nameFor(nearest.s);
        if (name) {
          input.value = name;
          state.lastSearchQ = name;
        }
      }
    } else {
      input.value = state.lastSearchQ;
    }
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
    // Dedupe to one row per (co, route) so the user does not see the same
    // physical route listed twice (once per direction / service variant).
    // The "regular" service (service_type '1') always wins as the main row;
    // if any sibling is a school special (typically service_type '3'), we
    // stash a `_hasSchool` flag on the data so routeRow can render a small
    // "school" pill next to the destination.
    const seenRoutes = new Map();
    const isRegularService = (r) => !r.service || String(r.service) === '1';
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
      const reg = isRegularService(r);
      if (prior) {
          // Always prefer a regular-service variant as the main row, even if
          // it scored lower on text matching; otherwise prefer the higher
          // score. This guarantees the user-facing row points at the regular
          // service rather than a school special.
          const upgrade = (reg && !prior.regular)
            || (reg === prior.regular && score > prior.score);
          if (upgrade) {
            const idx = matches.findIndex((m) => m.kind === 'route' && m.data === prior.data);
            if (idx >= 0) {
              const newHasSchool = prior.hasSchool || !reg;
              matches[idx] = { kind: 'route', data: { ...r, _hasSchool: newHasSchool }, score };
            }
            seenRoutes.set(routeKey, {
              score,
              count: prior.count + 1,
              regular: reg,
              hasSchool: prior.hasSchool || !reg,
            });
          } else {
            prior.count += 1;
            if (!reg) {
              prior.hasSchool = true;
              const idx = matches.findIndex((m) => m.kind === 'route' && m.data === prior.data);
              if (idx >= 0 && !matches[idx].data._hasSchool) {
                matches[idx] = { ...matches[idx], data: { ...matches[idx].data, _hasSchool: true } };
              }
            }
          }
          return;
        }
      seenRoutes.set(routeKey, { score, count: 1, regular: reg, hasSchool: !reg });
      push('route', { ...r, _hasSchool: !reg }, score);
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
  // Whether the home/search view should currently show the in-page
  // permission banner. We hide it once the user has either been asked
  // (state._geoAsked) or is mid-request (status === 'pending').
  function shouldShowGeoBanner() {
    return !state.userLoc && !state._geoAsked && state.locationStatus !== 'pending';
  }

  // In-page permission banner. Replaces the auto-prompt that used to fire
  // on first visit: the user must tap the CTA before we call the
  // browser's geolocation API. Hidden on next render after grant/deny.
  function buildGeoBanner() {
    const banner = el('div', { class: 'geo-banner', role: 'region', 'aria-label': t_str('geoBannerTitle') });
    const iconWrap = el('div', { class: 'geo-banner-icon', 'aria-hidden': 'true' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d',
      'M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z');
    svg.appendChild(path);
    iconWrap.appendChild(svg);
    banner.appendChild(iconWrap);

    const body = el('div', { class: 'geo-banner-body' });
    body.appendChild(el('div', { class: 'geo-banner-title' }, t_str('geoBannerTitle')));
    body.appendChild(el('div', { class: 'geo-banner-text' }, t_str('geoBannerBody')));
    banner.appendChild(body);

    const cta = el('button', {
      class: 'geo-banner-cta btn-primary',
      type: 'button',
      onclick: () => { requestLocation(); },
    }, t_str('geoBannerCta'));
    banner.appendChild(cta);

    return banner;
  }

  // "Nearest stop" pre-fill row — looks like a search-box, surfaces the
  // closest stop name with its distance, and clicks through to that stop
  // view. Hidden if location isn't granted or no nearby stops exist.
  function buildNearestStopPill() {
    if (!state.userLoc || !state.index) return null;
    const nearbyStops = Array.from(state.index.stops.values())
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .map((s) => ({ s, d: haversine(state.userLoc.lat, state.userLoc.lng, s.lat, s.lng) }))
      .sort((a, b) => a.d - b.d);
    const top = nearbyStops[0];
    if (!top) return null;
    const name = nameFor(top.s);
    const row = el('a', {
      class: 'nearest-stop-pill nearby-row',
      href: `#/stop/${encodeURIComponent(top.s.stop)}`,
      'aria-label': `${t_str('nearestStopLabel')}: ${name}`,
    });
    const left = el('span', { class: 'nearest-stop-icon', 'aria-hidden': 'true' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.8');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('d',
      'M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z');
    svg.appendChild(path);
    left.appendChild(svg);
    row.appendChild(left);

    const main = el('span', { class: 'nearest-stop-main' });
    main.appendChild(el('span', { class: 'nearest-stop-label' }, t_str('nearestStopLabel')));
    main.appendChild(el('span', { class: 'nearest-stop-name' }, name));
    row.appendChild(main);

    row.appendChild(el('span', { class: 'nearest-stop-dist nearby-dist' }, formatDistance(top.d)));
    row.appendChild(makeChev());
    return row;
  }

  // Populate the [data-bind="nearbyStops"|"nearbyRoutes"|"nearbyStations"]
  // containers inside `view`, sorted ascending by haversine distance.
  // Also handles the search view's status placeholders (locating / denied
  // / unavailable) so the user sees feedback while we wait.
  function populateNearbyInto(view) {
    if (!view || !state.index) return;
    const status = $('[data-bind="nearbyStatus"]', view);
    const status2 = $('[data-bind="nearbyStatus2"]', view);
    const status3 = $('[data-bind="nearbyStatus3"]', view);
    const stopsBlock = $('[data-bind="nearbyStops"]', view);
    const routesBlock = $('[data-bind="nearbyRoutes"]', view);
    const stationsBlock = $('[data-bind="nearbyStations"]', view);

    const setStatus = (node, msg) => {
      if (!node) return;
      const parent = node.parentElement;
      if (parent) parent.replaceChildren(el('p', { class: 'muted' }, msg));
    };

    if (state.locationStatus === 'pending') {
      setStatus(status, t_str('locating'));
      setStatus(status2, t_str('locating'));
      setStatus(status3, t_str('locating'));
      return;
    }
    if (state.locationStatus === 'denied') {
      setStatus(status, t_str('locationDenied'));
      setStatus(status2, t_str('locationDenied'));
      setStatus(status3, t_str('locationDenied'));
      return;
    }
    if (state.locationStatus === 'unavailable') {
      setStatus(status, t_str('locationUnavailable'));
      setStatus(status2, t_str('locationUnavailable'));
      setStatus(status3, t_str('locationUnavailable'));
      return;
    }
    if (!state.userLoc) return; // No permission yet — banner handles it.

    const loc = state.userLoc;

    // --- Nearby bus stops (only KMB/CTB/etc — stops we have lat/lng for) ---
    const nearbyStops = Array.from(state.index.stops.values())
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .map((s) => ({ s, d: haversine(loc.lat, loc.lng, s.lat, s.lng) }))
      .filter((x) => x.d < 1.2)
      .sort((a, b) => a.d - b.d)
      .slice(0, 12);

    if (nearbyStops.length === 0) {
      if (status || status2) {
        setStatus(status, t_str('noNearbyStops'));
        setStatus(status2, t_str('noNearbyRoutes'));
      } else {
        // Home view: bind blocks have only the section title we added.
        if (stopsBlock) stopsBlock.appendChild(el('p', { class: 'muted' }, t_str('noNearbyStops')));
        if (routesBlock) routesBlock.appendChild(el('p', { class: 'muted' }, t_str('noNearbyRoutes')));
      }
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

        // Re-resolve the live bind containers in case the view was
        // re-rendered while the fetch was in flight.
        const liveView = $('#' + view.id);
        const liveStops = $('[data-bind="nearbyStops"]', liveView || view);
        const liveRoutes = $('[data-bind="nearbyRoutes"]', liveView || view);
        if (liveStops) liveStops.replaceChildren(buildNearbyStops(stopItems));
        if (liveRoutes) liveRoutes.replaceChildren(buildNearbyRoutes(Array.from(routeMap.values())));
      });
    }

    // --- Nearby MTR stations (using embedded coords from mtr-stops.json) ---
    const nearbyMtr = Array.from(state.index.mtr.values())
      .filter((st) => st && !st._isLine)
      .filter((st) => Number.isFinite(st.lat) && Number.isFinite(st.lng))
      .map((st) => ({ st, d: haversine(loc.lat, loc.lng, st.lat, st.lng) }))
      .filter((x) => x.d < 1.5)
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);

    if (!stationsBlock) return;
    if (nearbyMtr.length === 0) {
      if (status3) {
        // Search view: status placeholder lives inside the bind block.
        setStatus(status3, t_str('noNearbyStations'));
      } else {
        // Home view: bind block has only the section title we added; keep
        // it and append a muted note below.
        stationsBlock.appendChild(el('p', { class: 'muted' }, t_str('noNearbyStations')));
      }
    } else {
      Promise.allSettled(nearbyMtr.map((x) => {
        const line = (x.st.lines && x.st.lines[0]) || null;
        return line ? fetchMtrSchedule(line, x.st.stop).catch(() => null) : Promise.resolve(null);
      })).then((results) => {
        const liveView = $('#' + view.id);
        const liveBlock = $('[data-bind="nearbyStations"]', liveView || view);
        if (liveBlock) liveBlock.replaceChildren(buildNearbyStations(nearbyMtr, results));
      });
    }
  }

  // Backwards-compatible wrapper for the search view. No longer auto-prompts
  // — the search view shows an in-page banner when location is needed.
  function renderNearby() {
    const view = $('#view-search');
    if (!view) return;
    populateNearbyInto(view);
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
      const name = nameFor(stop);
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
      const name = nameFor(st);
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
    if (r._hasSchool) {
      const schoolPill = el('span', { class: 'row-tag row-tag-school', title: t_str('schoolTagTitle') }, t_str('schoolTag'));
      titleEl.appendChild(document.createTextNode(' '));
      titleEl.appendChild(schoolPill);
    }
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
    main.appendChild(el('div', { class: 'row-title' }, nameFor(s) || s.stop));
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

  // Run an async worker against each item in `items`, with at most `cap`
  // in-flight at any time. Returns an array of settled results in the
  // same order as `items`. Used to fan out per-stop ETA requests without
  // hammering the upstream APIs on long routes.
  async function fetchStopsWithCap(items, cap, worker) {
    const results = new Array(items.length);
    if (items.length === 0) return results;
    const limit = Math.max(1, Math.min(cap, items.length));
    let cursor = 0;
    const inFlight = new Set();
    const pump = () => {
      while (inFlight.size < limit && cursor < items.length) {
        const i = cursor++;
        const p = (async () => {
          try {
            const value = await worker(items[i], i);
            results[i] = { status: 'fulfilled', value };
          } catch (e) {
            results[i] = { status: 'rejected', reason: e };
          }
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
    return results;
  }

  // ------------------------------------------------------------------
  // Route detail
  // ------------------------------------------------------------------
  function renderRoute(r) {
    state.detailRoute = r;
    state.detailStop = null;
    stopEtaRefresh();
    // Track every route visit in 最近查過 (not just saved ones).
    pushRecent({ co: r.co, route: r.route, dir: r.dir, service: r.service });

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

  // ------------------------------------------------------------------
  // Route-level service alerts
  // ------------------------------------------------------------------
  // Inspect every ETA across the route and decide whether to surface one
  // (and only one) banner. The result is always a single banner or null —
  // the priority order is intentional:
  //   1. No service at all        → "noServiceAlert" (warning)
  //   2. Last bus of day          → "lastBusAlert"   (critical)
  //   3. Cancelled/delayed stops  → "affectedServices" with count (warning)
  // We return an array (not a single object) so future severities can stack
  // without changing the call site, but the current banner UI only renders
  // alerts[0].
  function detectRouteAlerts(etaByStop, affectedStops) {
    // 1. No service at all: nothing returned for any stop on the route.
    if (etaByStop.size === 0) {
      return [{ severity: 'warning', key: 'noServiceAlert', args: [] }];
    }

    // 2. Last bus of day: at least one rmk_en === 'Last Bus' AND no
    //    remaining non-Last-Bus arrivals anywhere on the route. The "no
    //    other arrivals" half is the key — if regular services are still
    //    coming, we don't want to alarm the user that it's over.
    let hasLastBus = false;
    let hasNonLastBus = false;
    for (const etas of etaByStop.values()) {
      if (!Array.isArray(etas)) continue;
      for (const e of etas) {
        if (e && e.rmk_en === 'Last Bus') hasLastBus = true;
        else hasNonLastBus = true;
      }
    }
    if (hasLastBus && !hasNonLastBus) {
      return [{ severity: 'critical', key: 'lastBusAlert', args: [] }];
    }

    // 3. Cancelled / delayed individual arrivals: counted per-stop in the
    //    render loop above. Banner reports the number of affected stops,
    //    not the stop list, to keep the banner compact.
    if (affectedStops > 0) {
      return [{ severity: 'warning', key: 'affectedServices', args: [affectedStops] }];
    }

    return [];
  }

  function renderRouteAlert(alert, routeKey) {
    const banner = el('div', {
      class: `route-alert is-${alert.severity}`,
      role: alert.severity === 'critical' ? 'alert' : 'status',
      'aria-live': alert.severity === 'critical' ? 'assertive' : 'polite',
    });
    banner.appendChild(el('span', {
      class: 'route-alert-icon',
      'aria-hidden': 'true',
    }, alertIconSVG(alert.severity)));
    banner.appendChild(el('span', { class: 'route-alert-text' },
      t_str(alert.key, ...(alert.args || []))));
    const dismissKey = `${routeKey}|${alert.key}`;
    const dismissBtn = el('button', {
      type: 'button',
      class: 'route-alert-dismiss',
      'aria-label': t_str('dismissAlert'),
      onclick: () => {
        state.dismissedAlerts.add(dismissKey);
        banner.remove();
      },
    }, '\u00d7'); // ×
    banner.appendChild(dismissBtn);
    return banner;
  }

  function alertIconSVG(severity) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('aria-hidden', 'true');
    if (severity === 'critical') {
      // Filled circle with bang — "service disrupted, take this seriously".
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '10');
      c.setAttribute('fill', 'currentColor'); c.setAttribute('fill-opacity', '0.15');
      svg.appendChild(c);
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', '12'); ring.setAttribute('cy', '12'); ring.setAttribute('r', '10');
      ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', 'currentColor');
      ring.setAttribute('stroke-width', '1.6');
      svg.appendChild(ring);
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      bar.setAttribute('d', 'M12 7v6');
      bar.setAttribute('stroke', 'currentColor'); bar.setAttribute('stroke-width', '2');
      bar.setAttribute('stroke-linecap', 'round'); bar.setAttribute('fill', 'none');
      svg.appendChild(bar);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', '12'); dot.setAttribute('cy', '16.5'); dot.setAttribute('r', '1.1');
      dot.setAttribute('fill', 'currentColor');
      svg.appendChild(dot);
    } else {
      // Triangle with bang — heads-up but not service-stopped.
      const tri = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tri.setAttribute('d', 'M12 3.2 L22 20.5 L2 20.5 Z');
      tri.setAttribute('fill', 'currentColor'); tri.setAttribute('fill-opacity', '0.15');
      tri.setAttribute('stroke', 'currentColor'); tri.setAttribute('stroke-width', '1.6');
      tri.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(tri);
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      bar.setAttribute('d', 'M12 9v5.5');
      bar.setAttribute('stroke', 'currentColor'); bar.setAttribute('stroke-width', '2');
      bar.setAttribute('stroke-linecap', 'round'); bar.setAttribute('fill', 'none');
      svg.appendChild(bar);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', '12'); dot.setAttribute('cy', '17'); dot.setAttribute('r', '1.1');
      dot.setAttribute('fill', 'currentColor');
      svg.appendChild(dot);
    }
    return svg;
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

    // Pick the right route-stop endpoint based on operator. KMB / LWB share
    // /route-stop; CTB / NWFB use the Citybus endpoint.
    const isCitybus = (r.co === 'CTB' || r.co === 'NWFB');
    const fetchRouteStop = isCitybus
      ? () => fetchCitybusRouteStop(r.route, r.dir)
      : () => fetchKmbRouteStop(r.route, r.dir, r.service);
    fetchRouteStop().then(async (resp) => {
      const items = (resp && Array.isArray(resp.data)) ? resp.data : [];
      if (items.length === 0) {
        body.replaceChildren(el('p', { class: 'empty' }, t_str('routeNotFound')));
        return;
      }
      const stops = items
        .sort((a, b) => parseInt(a.seq, 10) - parseInt(b.seq, 10))
        .map((it) => {
          // For CTB / NWFB the stop id is the operator's 6-digit code; our
          // hk-stops.json has different codes (e.g. MA973). Build a richer
          // entry that uses the operator stop id directly plus any name we
          // know about from the index.
          const known = state.index.stops.get(it.stop);
          return {
            stop: it.stop,
            nameTc: known ? known.nameTc : it.stop,
            nameEn: known ? known.nameEn : '',
            lat: known && Number.isFinite(known.lat) ? known.lat : null,
            lng: known && Number.isFinite(known.lng) ? known.lng : null,
            _seq: parseInt(it.seq, 10),
          };
        });

      // Live arrivals for every stop on the route. CTB/NWFB stops use the
      // Citybus ETA endpoint; KMB-format stops use the KMB endpoint. We
      // run requests with a small concurrency cap so routes with 30+ stops
      // don't fire dozens of simultaneous calls to the upstream APIs.
      const etaResults = await fetchStopsWithCap(stops, 8, (s) => {
        if (isCitybus) return fetchCitybusStopEta(s.stop, r.route);
        return fetchKmbStopEta(s.stop);
      });
      const etaByStop = new Map();
      stops.forEach((s, i) => {
        const rr = etaResults[i];
        if (rr && rr.status === 'fulfilled' && rr.value && Array.isArray(rr.value.data)) {
          etaByStop.set(s.stop, rr.value.data
            .filter((e) => e.route === r.route
              && (isCitybus || (e.dir === r.dir && String(e.service_type) === String(r.service))))
            .filter((e) => !!e.eta)
            .sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime()));
        }
      });

      // Operator stop names ("書局街, 英皇道", "Shu Kuk Street, King's Road")
      // — the hk-stops.json index uses different ID formats, so the
      // operator endpoint is the source of truth for human-readable names.
      // Run in parallel with the ETA loop, capped concurrency, and fold the
      // result back into each stop row before rendering.
      const nameResults = await fetchStopsWithCap(stops, 8, (s) => {
        if (isCitybus) return fetchCitybusStop(s.stop);
        return fetchKmbStop(s.stop);
      });
      const nameByStop = new Map();
      stops.forEach((s, i) => {
        const rr = nameResults[i];
        if (rr && rr.status === 'fulfilled' && rr.value && rr.value.data) {
          let st = rr.value.data;
          if (Array.isArray(st)) st = st[0];
          if (st && (st.name_tc || st.name_sc || st.name_en)) {
            nameByStop.set(s.stop, {
              nameTc: st.name_tc || '',
              nameSc: st.name_sc || '',
              nameEn: st.name_en || '',
            });
          }
        }
      });

      // ---- Route-level polyline map ----
      // Build a Map<stopId, {lat,lng}> from any coords we already know
      // (index.hk-stops.json, or extracted from the nameResults above). For
      // stops still missing coords — typically CTB/NWFB stops whose 6-digit
      // IDs aren't in hk-stops.json — fall back to the operator's /stop
      // endpoint via ensureStopCoords(), which caches results across routes.
      const coordByStop = new Map();
      stops.forEach((s) => {
        if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) {
          coordByStop.set(s.stop, { lat: s.lat, lng: s.lng });
        }
      });
      // Also harvest coords from the operator /stop fetches we already
      // fired in the nameResults loop above — saves a duplicate request
      // for every CTB stop, which is most of them.
      nameResults.forEach((rr, i) => {
        const s = stops[i];
        if (!s || coordByStop.has(s.stop)) return;
        if (!rr || rr.status !== 'fulfilled' || !rr.value || !rr.value.data) return;
        let st = rr.value.data;
        if (Array.isArray(st)) st = st[0];
        if (!st) return;
        const lat = Number(st.lat);
        const lng = Number(st.long || st.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          coordByStop.set(s.stop, { lat, lng });
        }
      });
      const missingStops = stops.filter((s) => !coordByStop.has(s.stop));
      if (missingStops.length > 0) {
        await Promise.all(missingStops.map(async (s) => {
          const c = await ensureStopCoords(s.stop, isCitybus);
          if (c) coordByStop.set(s.stop, c);
        }));
      }
      const polylineEl = renderRoutePolyline(stops, coordByStop);

      const list = el('div', { class: 'eta-list' });
      // Pick the row that should be highlighted (the user's current stop)
      // and remember its DOM node so we can scroll it into view below.
      let targetRow = null;
      const targetSeq = (r.stopSeq && /^\d+$/.test(r.stopSeq)) ? parseInt(r.stopSeq, 10) : null;
      // Service-alert detection — see detectRouteAlerts() below for the
      // priority order (no-service > last-bus > cancelled/delayed). We also
      // accumulate the count of stops whose leading arrival is marked as
      // Cancelled/Suspended/Delayed/Disrupted so the warning banner can
      // surface a count of affected stops without naming each one.
      let affectedStops = 0;
      const CRITICAL_RMK = new Set(['Cancelled', 'Suspended', 'Delayed', 'Disrupted']);
      stops.forEach((s, idx) => {
        const seq = idx + 1;
        const isOrigin = idx === 0;
        const isTarget = targetSeq && seq === targetSeq;
        const classes = ['stop-row'];
        if (isOrigin) classes.push('is-origin');
        if (isTarget) classes.push('is-target');
        const row = el('a', { class: classes.join(' '), href: `#/stop/${encodeURIComponent(s.stop)}` });
        row.appendChild(el('span', { class: 'stop-idx' }, String(seq)));
        if (isTarget) {
          row.dataset.targetSeq = String(seq);
          targetRow = row;
        }
        const info = el('div', { class: 'stop-info' });
        // Prefer the operator's stop name (loaded from nameByStop above);
        // fall back to the hk-stops.json entry, then to the raw operator id.
        const fetchedName = nameByStop.get(s.stop);
        const nameDisplay = fetchedName ? nameFor(fetchedName) : nameFor(s);
        const enDisplay = fetchedName ? fetchedName.nameEn : (s.nameEn || '');
        info.appendChild(el('div', { class: 'stop-name-row' }, nameDisplay || s.stop));
        if (enDisplay) info.appendChild(el('div', { class: 'stop-name-en' }, enDisplay));
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
          // Leading-arrival remark drives the route-level cancelled/delayed
          // banner. We only check etas[0] per the spec — earlier arrivals have
          // already passed, so flagging them would mislead the user.
          if (CRITICAL_RMK.has(etas[0].rmk_en)) affectedStops++;
        } else if (idx === 0) {
          etaBox.appendChild(el('span', { class: 'small' }, t_str('loading')));
        } else {
          etaBox.appendChild(el('span', { class: 'small', style: 'color: var(--muted-2);' }, t_str('noEta')));
        }
        row.appendChild(etaBox);
        list.appendChild(row);
      });

      // Build a route-level alert banner (if any). Detection runs over the
      // full etaByStop map, not just the visible row, so a Last Bus marker
      // anywhere on the route can trigger the "last bus has departed" alert
      // even if the user is parked at a stop with its own upcoming service.
      const alerts = detectRouteAlerts(etaByStop, affectedStops);
      const routeKey = `${r.co}/${r.route}/${r.dir}/${r.service}`;
      const alertEl = (!state.dismissedAlerts.has(`${routeKey}|${alerts[0] && alerts[0].key}`) && alerts.length)
        ? renderRouteAlert(alerts[0], routeKey)
        : null;

      const heading = el('h2', { class: 'section-title' }, t_str('showingStop', stops.length));
      // Order: optional alert → polyline map → stop list heading → rows.
      // The polyline sits between the route header (above) and the stop
      // list (below), matching the justarrived.grok.me aesthetic.
      const children = [];
      if (alertEl) children.push(alertEl);
      if (polylineEl) children.push(polylineEl);
      children.push(heading, list);
      body.replaceChildren(...children);
      // Anchor the view at the user's current stop, justarrived-style.
      if (targetRow) {
        requestAnimationFrame(() => {
          try {
            targetRow.scrollIntoView({ behavior: 'auto', block: 'center' });
          } catch {}
        });
      }
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
        info.appendChild(el('div', { class: 'stop-name-row' }, nameFor(s) || s.code));
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
    const stationName = station ? nameFor(station) : stationCode;
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

    // Fetch LRT schedules for every stop on this route (capped concurrency).
    fetchStopsWithCap(stopsForDir, 8, (s) => fetchLrtSchedule(s.id || s.stop)).then((results) => {
      const etaByStop = new Map();
      stopsForDir.forEach((s, i) => {
        const rr = results[i];
        if (rr && rr.status === 'fulfilled' && rr.value && Array.isArray(rr.value.platform_list)) {
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
        info.appendChild(el('div', { class: 'stop-name-row' }, stopMeta ? nameFor(stopMeta) : s.stop));
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
        // ETA for every stop on the route, capped concurrency.
        const etaResults = await fetchStopsWithCap(stops, 8, (s) => fetchGmbStopEta(meta._routeId, parseInt(r.dir, 10) || 1, parseInt(s.stop, 10) || 0));
        const etaByStop = new Map();
        stops.forEach((s, i) => {
          const rr = etaResults[i];
          if (rr && rr.status === 'fulfilled' && rr.value && rr.value.data && rr.value.data.eta) {
            etaByStop.set(s.stop, rr.value.data.eta);
          }
        });
        const list = el('div', { class: 'eta-list' });
        // Anchor at the user's current stop_seq if supplied.
        let targetRow = null;
        const targetSeq = (r.stopSeq && /^\d+$/.test(r.stopSeq)) ? parseInt(r.stopSeq, 10) : null;
        stops.forEach((s, idx) => {
          const seq = idx + 1;
          const isOrigin = idx === 0;
          const isTarget = targetSeq && seq === targetSeq;
          const classes = ['stop-row'];
          if (isOrigin) classes.push('is-origin');
          if (isTarget) classes.push('is-target');
          const row = el('a', { class: classes.join(' '), href: `#/stop/${encodeURIComponent(s.stop)}` });
          row.appendChild(el('span', { class: 'stop-idx' }, String(seq)));
          if (isTarget) {
            row.dataset.targetSeq = String(seq);
            targetRow = row;
          }
          const info = el('div', { class: 'stop-info' });
          info.appendChild(el('div', { class: 'stop-name-row' }, nameFor(s) || s.stop));
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
        if (targetRow) {
          requestAnimationFrame(() => {
            try { targetRow.scrollIntoView({ behavior: 'auto', block: 'center' }); } catch {}
          });
        }
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
    const langPill = el('span', { class: 'route-lang-pill' },
      state.lang === 'zh-Hant' ? '繁體中文'
        : state.lang === 'zh-Hans' ? '简体中文'
        : 'English');
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
    // Track every stop visit in 最近查過 (not just saved ones).
    pushRecent({ stop: r.stop, co: r.co });

    // Dispatch on co.
    if (r.co === 'MTR') return renderMtrStationView(r.stop);
    if (r.co === 'LRT') return renderLrtStopView(r.stop);
    if (r.co === 'GMB') return renderGmbStopView(r.stop);
    return renderBusStopView(r.stop);
  }

  // ------------------------------------------------------------------
  // Schedule tab — fetch the day's pre-recorded arrival times for a stop.
  //
  // The KMB and Citybus open-data feeds don't expose a true "schedule-stop"
  // endpoint, but /stop-eta (KMB) and /batch/stop-eta/CTB/{stop} return the
  // next few scheduled arrivals for every route serving the stop. We surface
  // those times as a "timetable" preview grouped by hour — useful for
  // off-hours browsing when there is no live bus to chase.
  //
  // Results are cached in `scheduleCache` so re-visits skip the round-trip.
  // ------------------------------------------------------------------
  async function fetchStopSchedule(stopId, isCtb) {
    const cacheKey = `${isCtb ? 'CTB' : 'KMB'}|${stopId}`;
    if (scheduleCache.has(cacheKey)) return scheduleCache.get(cacheKey);

    const fetcher = isCtb
      ? () => fetchCitybusBatchStopEta(stopId)
      : () => fetchKmbStopEta(stopId);

    const promise = fetcher()
      .then((resp) => {
        const data = (resp && Array.isArray(resp.data)) ? resp.data : [];
        // Normalize rows from both operators into a single shape:
        // { co, route, dir, service, destTc, destEn, time (Date), seq }
        const rows = [];
        for (const e of data) {
          if (!e || !e.eta) continue; // skip null ETAs (route not running today)
          const t = new Date(e.eta);
          if (Number.isNaN(t.getTime())) continue;
          const co = isCtb ? 'CTB' : classifyKmbOp(e.route, '', e.dest_tc || '');
          rows.push({
            co,
            route: e.route,
            dir: e.dir,
            service: e.service_type != null ? String(e.service_type) : '1',
            destTc: e.dest_tc || e.dest || '',
            destEn: e.dest_en || '',
            time: t,
            seq: e.seq,
            rmk: e.rmk_tc || e.rmk_en || e.rmk || '',
          });
        }
        rows.sort((a, b) => a.time - b.time);
        scheduleCache.set(cacheKey, rows);
        return rows;
      })
      .catch((err) => {
        // Don't poison the cache on a single transient failure.
        console.warn('[schedule] fetch failed', err);
        return [];
      });

    return promise;
  }

  // Build the schedule tab DOM (tablist + panels). Returns
  // { refresh, panel, switchTo } so renderBusStopView can wire it up.
  function buildStopTabs(stopId, isCtb) {
    const isLive = (state._stopViewMode !== 'schedule');
    const tablist = el('div', { class: 'stop-tabs', role: 'tablist', 'aria-label': 'View mode' });

    const liveTab = el('button', {
      class: 'stop-tab' + (isLive ? ' is-on' : ''),
      type: 'button',
      role: 'tab',
      'aria-selected': isLive ? 'true' : 'false',
      id: 'stop-tab-live',
      'aria-controls': 'stop-panel-live',
      tabindex: isLive ? '0' : '-1',
    });
    const liveLabel = el('span', { class: 'stop-tab-primary' }, t_str('tabLive'));
    liveTab.appendChild(liveLabel);
    liveTab.appendChild(el('span', { class: 'stop-tab-secondary' }, t_str('tabLiveEn')));

    const scheduleTab = el('button', {
      class: 'stop-tab' + (!isLive ? ' is-on' : ''),
      type: 'button',
      role: 'tab',
      'aria-selected': !isLive ? 'true' : 'false',
      id: 'stop-tab-schedule',
      'aria-controls': 'stop-panel-schedule',
      tabindex: !isLive ? '0' : '-1',
    });
    scheduleTab.appendChild(el('span', { class: 'stop-tab-primary' }, t_str('tabSchedule')));
    scheduleTab.appendChild(el('span', { class: 'stop-tab-secondary' }, t_str('tabScheduleEn')));

    tablist.appendChild(liveTab);
    tablist.appendChild(scheduleTab);

    const livePanel = el('div', {
      class: 'stop-panel',
      role: 'tabpanel',
      id: 'stop-panel-live',
      'aria-labelledby': 'stop-tab-live',
      hidden: !isLive,
    });
    const schedulePanel = el('div', {
      class: 'stop-panel',
      role: 'tabpanel',
      id: 'stop-panel-schedule',
      'aria-labelledby': 'stop-tab-schedule',
      hidden: isLive,
    });

    const switchTo = (mode) => {
      state._stopViewMode = mode;
      const goLive = mode !== 'schedule';
      liveTab.classList.toggle('is-on', goLive);
      scheduleTab.classList.toggle('is-on', !goLive);
      liveTab.setAttribute('aria-selected', goLive ? 'true' : 'false');
      scheduleTab.setAttribute('aria-selected', goLive ? 'false' : 'true');
      liveTab.setAttribute('tabindex', goLive ? '0' : '-1');
      scheduleTab.setAttribute('tabindex', goLive ? '-1' : '0');
      livePanel.hidden = !goLive;
      schedulePanel.hidden = goLive;
      if (goLive) {
        // Delegate back to the live view renderer.
        state._refreshStop && state._refreshStop({ mode: 'live' });
      } else {
        renderSchedulePanel(schedulePanel, stopId, isCtb);
      }
    };

    liveTab.addEventListener('click', () => switchTo('live'));
    scheduleTab.addEventListener('click', () => switchTo('schedule'));

    // Keyboard navigation: ← / → move focus between tabs.
    tablist.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        (state._stopViewMode === 'schedule' ? liveTab : scheduleTab).focus();
      }
    });

    return { tablist, livePanel, schedulePanel, switchTo };
  }

  function renderSchedulePanel(panel, stopId, isCtb) {
    panel.innerHTML = '';
    panel.appendChild(el('p', { class: 'muted', style: 'text-align:center; padding: 24px 8px;' }, t_str('loadingSchedule')));

    fetchStopSchedule(stopId, isCtb).then((rows) => {
      panel.innerHTML = '';
      panel.appendChild(el('p', { class: 'muted', style: 'margin-top: 4px; font-size: 12px;' }, t_str('scheduleNote')));

      if (!rows.length) {
        panel.appendChild(el('p', { class: 'empty', style: 'margin-top: 12px;' }, t_str('scheduleEmpty')));
        return;
      }

      // Group rows by hour bucket (HH:00). Sort ascending within each hour.
      const byHour = new Map();
      for (const r of rows) {
        const h = r.time.getHours();
        if (!byHour.has(h)) byHour.set(h, []);
        byHour.get(h).push(r);
      }
      const hours = Array.from(byHour.keys()).sort((a, b) => a - b);

      const list = el('div', { class: 'stop-schedule' });
      for (const h of hours) {
        const bucket = el('section', { class: 'stop-schedule-bucket', 'aria-label': t_str('scheduleHour', h) });
        bucket.appendChild(el('h3', { class: 'stop-schedule-hour' }, t_str('scheduleHour', h)));
        const ul = el('ul', { class: 'stop-schedule-rows' });
        byHour.get(h).forEach((r) => {
          const destStr = pickFirst(r.destTc, r.destEn);
          const li = el('li', { class: 'stop-schedule-row' });
          li.appendChild(el('span', { class: 'stop-schedule-route' }, r.route));
          li.appendChild(el('span', { class: 'stop-schedule-time' }, formatHMTimestamp(r.time.toISOString())));
          if (destStr) li.appendChild(el('span', { class: 'stop-schedule-dest' }, destStr));
          li.appendChild(el('span', { class: 'stop-schedule-op' }, t_str(opCoKey(r.co))));
          ul.appendChild(li);
        });
        bucket.appendChild(ul);
        list.appendChild(bucket);
      }
      panel.appendChild(list);
    });
  }

  function renderBusStopView(stopId) {
    showView('view-stop');
    const view = renderInto('stop', 'stop');
    const header = $('[data-bind="stopHeader"]', view);
    const body = $('[data-bind="stopBody"]', view);
    header.innerHTML = '';
    body.innerHTML = '';

    // Decide which operator owns this stop by stop-ID format. KMB uses
    // 16-hex IDs, Citybus uses 6-digit numeric. Anything else falls back
    // to KMB; the live index entry will tell us if it was a misroute.
    const isCtb = typeof stopId === 'string' && /^[0-9]{6}$/.test(stopId);
    const opGuess = isCtb ? 'CTB' : 'KMB';

    header.appendChild(buildStopHeader(stopId, stopId, '', opGuess));

    // Stop view mode lives on the bus-stop view only. Default to 'live'
    // every time the user opens a new stop so they get the familiar arrival
    // board first; they can opt into the Schedule tab from there.
    state._stopViewMode = 'live';

    // Tab control + per-tab panels. Live panel keeps the existing
    // body element so the current rendering logic still works.
    const tabs = buildStopTabs(stopId, isCtb);
    const livePanel = tabs.livePanel;
    livePanel.appendChild(el('p', { class: 'muted' }, t_str('loading')));
    tabs.schedulePanel.appendChild(el('p', { class: 'muted', style: 'text-align:center; padding: 24px 8px;' }, t_str('loadingSchedule')));

    body.appendChild(tabs.tablist);
    body.appendChild(livePanel);
    body.appendChild(tabs.schedulePanel);

    const stopPromise = isCtb
      ? fetchCitybusStop(stopId).catch(() => null)
      : fetchKmbStop(stopId).catch(() => null);

    const stateRef = { panel: livePanel, header, stopId, view, schedulePanel: tabs.schedulePanel, switchTo: tabs.switchTo };
    state._refreshStop = (opts) => refreshBusStopView(stateRef, (opts && opts.mode) || 'live');

    stopPromise.then((stopResp) => {
      let nameTc = stopId, nameSc = '', nameEn = '';
      let stop = null;
      if (stopResp && stopResp.data) {
        stop = stopResp.data;
        if (Array.isArray(stop)) stop = stop[0];
        if (stop) {
          nameTc = stop.name_tc || nameTc;
          nameSc = stop.name_sc || '';
          nameEn = stop.name_en || '';
        }
      }
      // Fall back to the local index (hk-stops.json) for both names and lat/lng.
      const idxMeta = state.index.stops.get(stopId);
      if (idxMeta) {
        nameTc = pickFirst(idxMeta.nameTc, nameTc) || nameTc;
        nameSc = pickFirst(idxMeta.nameSc, nameSc) || nameSc;
        nameEn = pickFirst(idxMeta.nameEn, nameEn) || nameEn;
      }
      header.replaceChildren(...buildStopHeader(stopId, nameTc, nameEn, opGuess, nameSc).childNodes);
      state._lastStopName = nameFor({ nameTc, nameSc, nameEn });
      state._lastStopNameEn = nameEn;
    });

    refreshBusStopView(stateRef, 'live');
    startEtaRefresh(renderStopDetail);
  }

  // Fetch the latest ETAs for the current bus stop and re-render the body.
  // `mode` lets callers force a re-render of the live panel even when the
  // user is currently looking at the Schedule tab (used when switching back
  // to live so the board always shows fresh data).
  function refreshBusStopView(stateRef, mode) {
    if (!stateRef || !stateRef.panel) return;
    if (mode === 'schedule') return; // Schedule owns its own render path.
    const { stopId, panel: body } = stateRef;

    // Body only — never wipe the header.
    body.innerHTML = '';
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    const isCtb = typeof stopId === 'string' && /^[0-9]{6}$/.test(stopId);
    const etaPromise = isCtb ? null : fetchKmbStopEta(stopId).catch(() => null);

    Promise.resolve(etaPromise).then((etaResp) => {
      const data = etaResp && Array.isArray(etaResp.data) ? etaResp.data : [];

      // Map element (bottom): only when we have lat/lng.
      const mapEl = (() => {
        const meta = state.index.stops.get(stopId);
        if (!meta || !Number.isFinite(meta.lat) || !Number.isFinite(meta.lng)) return null;
        const m = renderStopMap(meta.lat, meta.lng, nameFor(meta) || stopId);
        return m.firstChild ? m : null;
      })();

      body.innerHTML = '';

      if (data.length === 0) {
        if (isCtb) {
          // CTB endpoints are per-(stop, route); we don't have an "all routes at this stop" feed.
          body.appendChild(el('p', { class: 'empty' }, t_str('noEta')));
          const hint = el('p', { class: 'muted', style: 'margin-top: 4px;' });
          hint.appendChild(document.createTextNode(t_str('ctbNoEtaHint') || ''));
          body.appendChild(hint);
        } else {
          body.appendChild(el('p', { class: 'empty' }, t_str('noEta')));
        }
        if (mapEl) body.appendChild(mapEl);
        return;
      }

      // Group arrivals by (co, route, dir, service, dest). Keep up to 3 ETAs
      // per group sorted by time. Just like justarrived.grok.me: one card
      // per route, primary arrival big + 2 more as secondary text.
      const routeMap = new Map();
      data
        .filter((e) => !!e.eta)
        .forEach((e) => {
          const co = classifyKmbOp(e.route, '', e.dest_tc || '');
          const key = `${co}|${e.route}|${e.dir}|${e.service_type}|${e.dest_tc || ''}`;
          if (!routeMap.has(key)) {
            routeMap.set(key, {
              co, route: e.route, dir: e.dir, service: e.service_type,
              destTc: e.dest_tc, destEn: e.dest_en,
              seq: e.seq,
              arrivals: [],
            });
          }
          routeMap.get(key).arrivals.push({
            eta: e.eta,
            minutes: minutesUntil(e.eta),
            rmk: e.rmk_en,
          });
        });

      routeMap.forEach((r) => {
        r.arrivals.sort((a, b) => (a.minutes ?? 9999) - (b.minutes ?? 9999));
        // Trim the primary arrival's stop seq for the route-detail anchor.
        if (r.seq == null && r.arrivals.length > 0) {
          // KMB /stop-eta carries an explicit seq; nothing to backfill here.
        }
      });

      const routes = Array.from(routeMap.values()).sort((a, b) => {
        const aMin = a.arrivals[0]?.minutes ?? 9999;
        const bMin = b.arrivals[0]?.minutes ?? 9999;
        return aMin - bMin;
      });

      body.appendChild(el('h2', { class: 'section-title' }, t_str('nextArrivals')));
      const list = el('div', { class: 'arrival-list' });

      routes.forEach((r) => {
        const anchor = r.seq != null ? `/${encodeURIComponent(String(r.seq))}` : '';
        const href = `#/route/${encodeURIComponent(r.co)}/${encodeURIComponent(r.route)}/${encodeURIComponent(r.dir)}/${encodeURIComponent(r.service)}${anchor}`;
        const card = el('a', { class: 'arrival-card', href });

        // ---- left: route number + operator pill + destination + fare ----
        const left = el('div', { class: 'arrival-card-left' });
        left.appendChild(el('div', { class: 'arrival-card-route' }, r.route));
        const meta = el('div', { class: 'arrival-card-meta' });
        meta.appendChild(el('span', { class: 'arrival-card-op' }, t_str(opCoKey(r.co))));
        const destStr = pickFirst(r.destTc, r.destEn);
        if (destStr) meta.appendChild(el('span', { class: 'arrival-card-dest' }, `往 ${destStr}`));
        left.appendChild(meta);
        card.appendChild(left);

        // ---- right: primary time + up to 2 more ----
        const right = el('div', { class: 'arrival-card-right' });
        r.arrivals.slice(0, 3).forEach((a, i) => {
          if (i === 0) {
            const pcls = ['arrival-card-primary'];
            if (a.minutes != null && a.minutes > 0 && a.minutes <= 2) pcls.push('is-soon');
            const isNow = (a.minutes == null || a.minutes <= 0);
            if (isNow) pcls.push('is-now');
            const primary = el('div', { class: pcls.join(' ') });
            if (isNow) {
              primary.appendChild(el('span', { class: 'arrival-card-now' }, t_str('arriving')));
            } else {
              primary.appendChild(el('span', { class: 'arrival-card-mins' }, String(a.minutes)));
              primary.appendChild(document.createTextNode(' ' + t_str('minShort')));
            }
            primary.appendChild(el('span', { class: 'arrival-card-clock' }, formatHMTimestamp(a.eta)));
            right.appendChild(primary);
          } else {
            const sec = el('div', { class: 'arrival-card-secondary' });
            sec.appendChild(document.createTextNode(`${a.minutes} ${t_str('minShort')} · ${formatHMTimestamp(a.eta)}`));
            if (a.rmk === 'Last Bus') sec.appendChild(el('span', { class: 'arrival-card-tag' }, t_str('lastBus') || 'Last'));
            right.appendChild(sec);
          }
        });
        card.appendChild(right);
        list.appendChild(card);
      });

      body.appendChild(list);
      if (mapEl) body.appendChild(mapEl);
    });
  }

  // Format an ETA ISO timestamp as "HH:MM" (24h).
  function formatHMTimestamp(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
    header.appendChild(buildStopHeader(stopCode, nameFor(stop || { nameTc, nameEn }) || nameTc, nameEn, 'LRT'));
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
        // Anchor the route detail at THIS stop_seq so the user lands at
        // their current stop, just like justarrived.grok.me.
        const href = `#/route/GMB/${encodeURIComponent(row.routeId)}/${encodeURIComponent(row.routeSeq)}/${encodeURIComponent(row.stopSeq)}`;
        const li = el('a', { class: 'row', href });
        li.appendChild(makeBadge('GMB'));
        const main = el('div', { class: 'row-main' });
        main.appendChild(el('div', { class: 'row-title' }, row.name || ''));
        main.appendChild(el('div', { class: 'row-sub' }, `${t_str('route')} #${row.routeId}`));
        li.appendChild(main);
        li.appendChild(el('div', { class: 'row-meta' },
          row === head && etaInfo
            ? el('span', { class: 'row-eta' }, `${etaInfo.diff} ${t_str('minShort')}`)
            : el('div', { class: 'row-dim' }, t_str('scheduled'))));
        li.appendChild(makeChev());
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
      body.replaceChildren(wrap);
      // Append the map at the bottom (justarrived.grok.me pattern).
      const meta = state._lastGmbStopMeta;
      state._lastGmbStopMeta = null;
      if (meta && Number.isFinite(meta.lat) && Number.isFinite(meta.lng)) {
        const mapEl = renderStopMap(meta.lat, meta.lng, nameFor(meta) || stopId);
        if (mapEl.firstChild) body.appendChild(mapEl);
      }
    }).catch(() => body.replaceChildren(el('p', { class: 'empty' }, t_str('noEta'))));

    startEtaRefresh(renderStopDetail);
  }

  // Stop view header — modeled on justarrived.grok.me:
  // back chevron + language toggle (top bar), small operator pill, big stop name,
  // red accent rule, "剛剛更新 · HH:MM" sub-line.
  function buildStopHeader(stopId, nameTc, nameEn, co, nameSc) {
    const head = el('div', { class: 'stop-header' });

    // ---- top action bar ----
    const topbar = el('div', { class: 'stop-topbar' });
    topbar.appendChild(el('a', {
      class: 'stop-back',
      'aria-label': t_str('back'),
      href: '#/',
    }, (function () {
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
    })()));

    const topRight = el('div', { class: 'stop-topbar-right' });
    // The pill shows the *current* language; clicking cycles to the next one.
    const langPill = el('span', { class: 'stop-lang-pill' },
      state.lang === 'zh-Hant' ? '繁體中文'
        : state.lang === 'zh-Hans' ? '简体中文'
        : 'English');
    topRight.appendChild(langPill);

    const isFav = state.savedStops.some((s) => sameStop(s, { stop: stopId }));
    const star = el('button', {
      type: 'button',
      class: `stop-fav ${isFav ? 'is-fav' : ''}`,
      'aria-label': isFav ? t_str('saved') : t_str('save'),
      'aria-pressed': String(isFav),
      onclick: () => {
        toggleSaveStop({ stop: stopId });
        head.replaceChildren(...buildStopHeader(stopId, nameTc, nameEn, co).childNodes);
      },
    });
    star.appendChild(starIconSVG(isFav));
    topRight.appendChild(star);
    topbar.appendChild(topRight);
    head.appendChild(topbar);

    // ---- operator pill (small, above title) ----
    if (co && co !== 'STOP') {
      head.appendChild(el('span', { class: 'stop-op-pill' }, t_str(opCoKey(co))));
    }

    // ---- main stop name ----
    head.appendChild(el('h1', { class: 'stop-name' }, nameFor({ nameTc, nameSc: nameSc || '', nameEn }) || stopId));
    if (nameEn) head.appendChild(el('p', { class: 'stop-name-en' }, nameEn));

    // ---- red accent rule ----
    head.appendChild(el('div', { class: 'stop-accent' }));

    // ---- "updated HH:MM" + refresh button ----
    const meta = el('div', { class: 'stop-meta' });
    const updateLeft = el('div', { class: 'stop-meta-left' });
    updateLeft.appendChild(el('p', { class: 'stop-updated-when', 'data-bind': 'stop-updated-when' }, t_str('updatedJust')));
    meta.appendChild(updateLeft);
    const refreshBtn = el('button', {
      type: 'button',
      class: 'stop-refresh',
      'aria-label': t_str('refresh'),
      onclick: () => { if (typeof state._refreshStop === 'function') state._refreshStop(); else location.reload(); },
    }, refreshIconSVG());
    meta.appendChild(refreshBtn);
    head.appendChild(meta);

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
  // Planner view (A → B trip planner) — rendering lives in planner.js
  // ------------------------------------------------------------------
  function renderPlannerView() {
    showView('view-planner');
    const view = document.getElementById('view-planner');
    if (!view) return;
    // Planner.js owns the markup; we just hand it the view shell.
    if (window.Planner && typeof window.Planner.renderPlanner === 'function') {
      window.Planner.renderPlanner(view);
    } else {
      view.innerHTML = '<div class="container" style="padding: 24px 16px; color: var(--muted);">Trip planner failed to load.</div>';
    }
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
    // Both route and stop views have an "updated HH:MM" element — find the
    // one in the currently visible view so refresh never bleeds across views.
    const candidates = document.querySelectorAll('[data-bind="route-updated-when"], [data-bind="stop-updated-when"]');
    if (!candidates.length) return;
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const label = `${t_str('updatedJust')} · ${hh}:${mm}`;
    candidates.forEach((node) => {
      // Only touch the visible one (parents hidden via the `hidden` attr).
      let p = node;
      while (p && p !== document.body) {
        if (p.hasAttribute && p.hasAttribute('hidden')) return;
        p = p.parentElement;
      }
      node.textContent = label;
    });
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
    document.documentElement.lang = state.lang === 'en' ? 'en'
      : state.lang === 'zh-Hans' ? 'zh-Hans' : 'zh-Hant';
    // Show the CURRENT language on the toggle pill (not the next one).
    // The button label cycles 繁體中文 → 简体中文 → English on each click.
    const btn = document.getElementById('langToggle');
    if (btn) {
      const cur = btn.querySelector('.lang-current');
      if (cur) {
        cur.textContent = state.lang === 'zh-Hant' ? '繁體中文'
          : state.lang === 'zh-Hans' ? '简体中文'
          : 'English';
      }
      btn.setAttribute('aria-label', state.lang === 'zh-Hant' ? '切換語言'
        : state.lang === 'zh-Hans' ? '切换语言'
        : 'Switch language');
    }
    applyI18n(document.body);
  }
  function toggleLang() {
    // Cycle: zh-Hant → zh-Hans → en → zh-Hant
    state.lang = state.lang === 'zh-Hant' ? 'zh-Hans'
      : state.lang === 'zh-Hans' ? 'en' : 'zh-Hant';
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

  // ------------------------------------------------------------------
  // Expose the minimum surface the planner (planner.js) needs to read
  // the index, i18n dict, and a few small helpers. The planner owns its
  // own rendering; this just gives it read access to shared state.
  // ------------------------------------------------------------------
  window.state = state;
  window.STRINGS = STRINGS;
  window.el = el;
  window.t_str = t_str;
  window.nameFor = nameFor;
  window.makeRouteKey = makeRouteKey;
})();