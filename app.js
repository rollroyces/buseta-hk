/* ============================================================
   BusETA HK · 巴士到站 — application logic
   ============================================================
   Public data sources:
     KMB / LWB  → https://data.etabus.gov.hk/v1/transport/kmb/
     Citybus    → https://rt.data.gov.hk/v2/transport/citybus/
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
      operatorsTitle: '支援巴士公司',
      operatorsNote: '獨立第三方應用。資料由各營辦商透過運輸署公開數據提供。',
      emptyRoutes: '未有收藏路線。',
      emptyStops: '未有收藏車站。',
      emptyRecent: '未有最近查過嘅路線。',
      footerAttribution: '資料來源：運輸署資料一線通。到站時間來自九巴、龍運及城巴；車費來自公共交通路線及收費資料。預計時間約每分鐘更新，只供參考。',
      searchPlaceholder: '路線、地點或車站',
      filterAll: '全部',
      filterKMB: '九巴',
      filterLWB: '龍運',
      filterCTB: '城巴',
      nearbyRoutes: '附近路線',
      nearbyStops: '附近車站',
      locating: '定位中…',
      locationDenied: '定位被拒絕，未能取得附近路線。',
      locationUnavailable: '未能取得位置，未能提供附近路線。',
      noResults: '搵唔到相關嘅路線或車站。',
      back: '返回',
      route: '路線',
      stop: '車站',
      to: '→',
      inbound: '入站',
      outbound: '出站',
      save: '收藏',
      saved: '已收藏',
      unsave: '取消收藏',
      minShort: '分',
      arriving: '即將到站',
      scheduled: '原定班次',
      lastBus: '尾班車',
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
      routeNotFound: '搵唔到呢條路線。',
      stopNotFound: '搵唔到呢個車站。',
      noNearbyRoutes: '附近範圍未有常見路線。',
      noNearbyStops: '附近範圍未有常見車站。',
      searchHint: '輸入路線編號、車站名或地點',
      noFavHint: '搜尋後可以加入收藏，方便日後對陣查閱。',
      clearRecent: '清除記錄',
      cleared: '已清除',
      toStop: '去呢個車站',
      toRoute: '睇路線詳情',
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
      operatorsTitle: 'Supported operators',
      operatorsNote: 'Independent third-party app. Data published via Transport Department open data.',
      emptyRoutes: 'No saved routes yet.',
      emptyStops: 'No saved stops yet.',
      emptyRecent: 'No recent searches.',
      footerAttribution: 'Data source: Transport Department Data One. Arrivals from KMB, LWB and Citybus; fares from public transport data. ETAs refresh about every minute, for reference only.',
      searchPlaceholder: 'Route, place or stop',
      filterAll: 'All',
      filterKMB: 'KMB',
      filterLWB: 'LWB',
      filterCTB: 'Citybus',
      nearbyRoutes: 'Nearby routes',
      nearbyStops: 'Nearby stops',
      locating: 'Locating…',
      locationDenied: 'Location denied — nearby routes unavailable.',
      locationUnavailable: 'Location unavailable — nearby routes unavailable.',
      noResults: 'No matching routes or stops.',
      back: 'Back',
      route: 'Route',
      stop: 'Stop',
      to: '→',
      inbound: 'Inbound',
      outbound: 'Outbound',
      save: 'Save',
      saved: 'Saved',
      unsave: 'Unsave',
      minShort: 'min',
      arriving: 'Arriving',
      scheduled: 'Scheduled',
      lastBus: 'Last bus',
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
      routeNotFound: 'Route not found.',
      stopNotFound: 'Stop not found.',
      noNearbyRoutes: 'No nearby routes found.',
      noNearbyStops: 'No nearby stops found.',
      searchHint: 'Enter route number, stop name or place',
      noFavHint: 'Search and tap the star to save routes and stops for quick access.',
      clearRecent: 'Clear',
      cleared: 'Cleared',
      toStop: 'Open stop',
      toRoute: 'Open route',
    },
  };

  // ------------------------------------------------------------------
  // Constants
  // ------------------------------------------------------------------
  const API = {
    KMB: 'https://data.etabus.gov.hk/v1/transport/kmb',
    CITYBUS: 'https://rt.data.gov.hk/v2/transport/citybus',
  };

  const STORAGE_KEYS = {
    LANG: 'buseta.lang',
    ROUTES: 'buseta.saved.routes',
    STOPS: 'buseta.saved.stops',
    RECENT: 'buseta.recent',
    INDEX: 'buseta.index',
    INDEX_TS: 'buseta.index.ts',
  };

  const REFRESH_INTERVAL_MS = 60_000;
  const INDEX_MAX_AGE_MS = 12 * 60 * 60 * 1000;

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
  const sameStop = (a, b) => a.stop === b.stop;

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
  // ------------------------------------------------------------------
  function rehydrateIndex(raw) {
    return {
      routes: new Map(raw.routes || []),
      stops: new Map(raw.stops || []),
      ctbRoutes: new Map(raw.ctbRoutes || []),
    };
  }
  function dehydrateIndex(idx) {
    return {
      routes: Array.from(idx.routes.entries()),
      stops: Array.from(idx.stops.entries()),
      ctbRoutes: Array.from(idx.ctbRoutes.entries()),
    };
  }

  async function loadIndex() {
    if (state.index) return state.index;
    const cached = storage.get(STORAGE_KEYS.INDEX, null);
    const ts = storage.get(STORAGE_KEYS.INDEX_TS, 0);
    if (cached && Date.now() - ts < INDEX_MAX_AGE_MS) {
      state.index = rehydrateIndex(cached);
      // Background refresh (don't await)
      buildIndex().catch(() => {});
      return state.index;
    }
    return buildIndex();
  }

  async function buildIndex() {
    const [kmbRoutes, kmbStops, ctbRoutes] = await Promise.all([
      fetchJSON(`${API.KMB}/route/`).catch(() => null),
      fetchJSON(`${API.KMB}/stop/`).catch(() => null),
      fetchJSON(`${API.CITYBUS}/route/ctb`).catch(() => null),
    ]);

    const routes = new Map();
    const stops = new Map();
    const ctb = new Map();

    if (kmbRoutes && Array.isArray(kmbRoutes.data)) {
      for (const r of kmbRoutes.data) {
        const key = makeRouteKey('KMB', r.route, r.bound, r.service_type);
        const op = classifyKmbOp(r.route, r.orig_tc || '', r.dest_tc || '');
        routes.set(key, {
          co: op,
          route: r.route,
          dir: r.bound,
          service: r.service_type,
          origTc: r.orig_tc,
          origEn: r.orig_en,
          destTc: r.dest_tc,
          destEn: r.dest_en,
        });
      }
    }
    if (kmbStops && Array.isArray(kmbStops.data)) {
      for (const s of kmbStops.data) {
        stops.set(s.stop, {
          stop: s.stop,
          nameTc: s.name_tc,
          nameEn: s.name_en,
          lat: parseFloat(s.lat),
          lng: parseFloat(s.long),
        });
      }
    }
    if (ctbRoutes && Array.isArray(ctbRoutes.data)) {
      for (const r of ctbRoutes.data) {
        const op = r.co === 'NWFB' ? 'NWFB' : 'CTB';
        const key = makeRouteKey(op, r.route, 'O', '1');
        ctb.set(key, {
          co: op,
          route: r.route,
          dir: 'O',
          service: '1',
          origTc: r.orig_tc,
          origEn: r.orig_en,
          destTc: r.dest_tc,
          destEn: r.dest_en,
        });
      }
    }

    state.index = { routes, stops, ctbRoutes: ctb };
    storage.set(STORAGE_KEYS.INDEX, dehydrateIndex(state.index));
    storage.set(STORAGE_KEYS.INDEX_TS, Date.now());
    return state.index;
  }

  // ------------------------------------------------------------------
  // Network
  // ------------------------------------------------------------------
  async function fetchJSON(url, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  const fetchKmbRouteStop = (route, dir, service) =>
    fetchJSON(`${API.KMB}/route-stop/${encodeURIComponent(route)}/${dir === 'I' ? 'inbound' : 'outbound'}/${encodeURIComponent(service)}`);
  const fetchKmbStop = (stopId) =>
    fetchJSON(`${API.KMB}/stop/${encodeURIComponent(stopId)}`);
  const fetchKmbStopEta = (stopId) =>
    fetchJSON(`${API.KMB}/stop-eta/${encodeURIComponent(stopId)}`);

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
    let m = h.match(/^\/route\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/);
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

    state.index.routes.forEach((r) => {
      if (!matchesFilter(r.co)) return;
      const rlow = String(r.route).toLowerCase();
      const text = `${norm(r.origTc)} ${norm(r.origEn)} ${norm(r.destTc)} ${norm(r.destEn)}`;
      let score = 0;
      if (rlow === lower) score += 100;
      else if (rlow.startsWith(lower)) score += 50;
      else if (rlow.includes(lower)) score += 30;
      if (text.includes(lower)) score += 10;
      if (score > 0) push('route', r, score);
    });

    state.index.ctbRoutes.forEach((r) => {
      if (!matchesFilter(r.co)) return;
      const rlow = String(r.route).toLowerCase();
      const text = `${norm(r.origTc)} ${norm(r.origEn)} ${norm(r.destTc)} ${norm(r.destEn)}`;
      let score = 0;
      if (rlow === lower) score += 100;
      else if (rlow.startsWith(lower)) score += 50;
      else if (rlow.includes(lower)) score += 30;
      if (text.includes(lower)) score += 10;
      if (score > 0) push('route', r, score);
    });

    state.index.stops.forEach((s) => {
      const text = `${norm(s.nameTc)} ${norm(s.nameEn)}`;
      let score = 0;
      if (text.includes(lower)) score += 10;
      if (s.stop.toLowerCase() === lower) score += 80;
      if (score > 0) push('stop', s, score);
    });

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, 60);
  }

  function matchesFilter(co) {
    if (state.filter === 'ALL') return true;
    if (state.filter === 'KMB') return co === 'KMB';
    if (state.filter === 'LWB') return co === 'LWB';
    if (state.filter === 'CTB') return co === 'CTB' || co === 'NWFB';
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
    if (!status || !status2) return;

    if (state.locationStatus === 'idle') {
      status.textContent = t_str('locating');
      status2.textContent = t_str('locating');
      requestLocation();
      return;
    }
    if (state.locationStatus === 'pending') {
      status.textContent = t_str('locating');
      status2.textContent = t_str('locating');
      return;
    }
    if (state.locationStatus === 'denied') {
      status.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('locationDenied')));
      status2.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('locationDenied')));
      return;
    }
    if (state.locationStatus === 'unavailable') {
      status.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('locationUnavailable')));
      status2.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('locationUnavailable')));
      return;
    }

    const nearbyStops = Array.from(state.index.stops.values())
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .map((s) => ({ s, d: haversine(state.location.lat, state.location.lng, s.lat, s.lng) }))
      .filter((x) => x.d < 1.2)
      .sort((a, b) => a.d - b.d)
      .slice(0, 12);

    if (nearbyStops.length === 0) {
      status.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('noNearbyStops')));
      status2.parentElement.replaceChildren(el('p', { class: 'muted' }, t_str('noNearbyRoutes')));
      return;
    }

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
      row.appendChild(makeBadge('STOP'));
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
    return el('span', { class: `row-badge co-${co}` }, co === 'STOP' ? '·' : co);
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
    const dirLabel = r.dir === 'I' ? t_str('inbound') : t_str('outbound');
    const dest = pickFirst(r.destTc, r.destEn);
    const orig = pickFirst(r.origTc, r.origEn);
    const a = el('a', {
      class: 'row',
      href: `#/route/${encodeURIComponent(r.co)}/${encodeURIComponent(r.route)}/${encodeURIComponent(r.dir)}/${encodeURIComponent(r.service)}`,
    });
    a.appendChild(makeBadge(r.co));
    const main = el('div', { class: 'row-main' });
    main.appendChild(el('div', { class: 'row-title' }, r.route,
      el('span', { style: 'color: var(--muted); margin: 0 6px; font-weight: 500;' }, '·'),
      dest));
    main.appendChild(el('div', { class: 'row-sub' }, `${dirLabel} · ${orig}`));
    a.appendChild(main);
    a.appendChild(el('div', { class: 'row-meta' }, el('div', { class: 'row-dim' }, t_str(opCoKey(r.co)))));
    a.appendChild(makeChev());
    return a;
  }

  function stopRow(s) {
    const a = el('a', { class: 'row', href: `#/stop/${encodeURIComponent(s.stop)}` });
    a.appendChild(makeBadge('STOP'));
    const main = el('div', { class: 'row-main' });
    main.appendChild(el('div', { class: 'row-title' }, pickFirst(s.nameTc, s.nameEn) || s.stop));
    main.appendChild(el('div', { class: 'row-sub' }, s.nameEn || (s.stop ? s.stop.slice(0, 10) : '')));
    a.appendChild(main);
    a.appendChild(el('div', { class: 'row-meta' }, el('div', { class: 'row-dim' }, t_str('stop'))));
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
    const dirLabel = r.dir === 'I' ? t_str('inbound') : t_str('outbound');

    header.appendChild(buildRouteHeader(r.co, r.route, r.dir, r.service, dest, orig, dirLabel));
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    state.detailRoute = r;
    state.detailStop = null;

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

  function buildRouteHeader(co, route, dir, service, dest, orig, dirLabel) {
    const head = el('div', { class: 'route-header' });
    const top = el('div', { class: 'route-head-top' });
    top.appendChild(el('div', { class: 'route-badge' }, route));
    top.appendChild(el('span', { class: 'route-op' }, t_str(opCoKey(co))));
    head.appendChild(top);
    head.appendChild(el('div', { class: 'route-dest' }, dest || route));
    if (orig) head.appendChild(el('div', { class: 'route-dest-sub' }, `${dirLabel} · ${orig}`));

    const actions = el('div', { class: 'route-actions' });
    const favKey = { co, route, dir, service };
    const isFav = state.savedRoutes.some((x) => sameRoute(x, favKey));
    actions.appendChild(el('button', {
      class: 'btn-secondary', type: 'button',
      onclick: (e) => {
        toggleSaveRoute(favKey);
        head.replaceChildren(...buildRouteHeader(co, route, dir, service, dest, orig, dirLabel).childNodes);
      },
    }, isFav ? t_str('saved') : t_str('save')));
    head.appendChild(actions);
    return head;
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
    showView('view-stop');
    const view = renderInto('stop', 'stop');
    const header = $('[data-bind="stopHeader"]', view);
    const body = $('[data-bind="stopBody"]', view);
    header.innerHTML = '';
    body.innerHTML = '';
    header.appendChild(buildStopHeader(r.stop, r.stop));
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    state.detailStop = r;
    state.detailRoute = null;

    Promise.all([fetchKmbStop(r.stop).catch(() => null), fetchKmbStopEta(r.stop).catch(() => null)])
      .then(([stopResp, etaResp]) => {
        const stop = stopResp && stopResp.data ? stopResp.data : { stop: r.stop, name_tc: r.stop, name_en: '' };
        const data = etaResp && Array.isArray(etaResp.data) ? etaResp.data : [];
        header.replaceChildren(...buildStopHeader(r.stop, stop.name_tc, stop.name_en).childNodes);

        const groups = new Map();
        data.forEach((e) => {
          if (!e.eta) return;
          const co = classifyKmbOp(e.route, '', e.dest_tc || '');
          const key = makeRouteKey(co, e.route, e.dir, e.service_type);
          if (!groups.has(key)) groups.set(key, { co, route: e.route, dir: e.dir, service: e.service_type, destTc: e.dest_tc, destEn: e.dest_en, etas: [] });
          groups.get(key).etas.push({ eta: e.eta, rmk: e.rmk_en });
        });

        if (groups.size === 0) {
          body.replaceChildren(el('p', { class: 'empty' }, t_str('noEta')));
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
      });

    startEtaRefresh(renderStopDetail);
  }

  function buildStopHeader(stopId, nameTc, nameEn) {
    const head = el('div', { class: 'stop-header' });
    head.appendChild(el('div', { class: 'stop-name' }, pickFirst(nameTc, nameEn) || stopId));
    if (nameEn) head.appendChild(el('div', { class: 'stop-name-en' }, nameEn));
    const actions = el('div', { class: 'stop-actions' });
    const isFav = state.savedStops.some((s) => sameStop(s, { stop: stopId }));
    actions.appendChild(el('button', {
      class: 'btn-secondary', type: 'button',
      onclick: () => {
        toggleSaveStop({ stop: stopId });
        head.replaceChildren(...buildStopHeader(stopId, nameTc, nameEn).childNodes);
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
    const key = item.stop ? JSON.stringify({ stop: item.stop }) : JSON.stringify(makeRouteKey(item.co, item.route, item.dir, item.service));
    state.recent = [item, ...state.recent.filter((x) => {
      const k = x.stop ? JSON.stringify({ stop: x.stop }) : JSON.stringify(makeRouteKey(x.co, x.route, x.dir, x.service));
      return k !== key;
    })].slice(0, 20);
    persist();
  }

  // ------------------------------------------------------------------
  // Auto-refresh
  // ------------------------------------------------------------------
  function startEtaRefresh(fn) {
    clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => fn(), REFRESH_INTERVAL_MS);
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