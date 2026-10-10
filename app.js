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
      emptyFavRoutesCta: '收藏常用路線',
      emptyFavStopsCta: '收藏常用車站',
      emptyRecentCta: '開始搜尋',
      emptyFavRoutesTip: '喺路線頁長按星號即可加入收藏',
      emptyFavStopsTip: '喺車站頁長按星號即可加入收藏',
      emptyRecentTip: '搜尋路線或車站後會自動加入呢度',
      onboardTitle: '歡迎使用 BusETA HK',
      onboardLead: '三個步驟開始你嘅第一個旅程：',
      onboardPlannerTitle: '規劃行程',
      onboardPlannerBody: '輸入起點同終點，搵出最快、最平或最少轉乘嘅路線。',
      onboardSearchTitle: '搜尋路線同車站',
      onboardSearchBody: '輸入路線、巴士站、港鐵站或地點名稱，搵到即時到站時間。',
      onboardNearbyTitle: '啟用定位',
      onboardNearbyBody: '啟用之後會顯示附近嘅巴士站、港鐵站同熱門路線。',
      onboardDismiss: '知道了',
      homeEmptyTitle: '探索附近路線，計劃你嘅行程',
      homeEmptySearch: '搜尋路線',
      homeEmptyLocate: '啟用定位',
      homeEmptyLocateUpdate: '更新定位',
      homeEmptyHot: '熱門路線',
      homeEmptyTip: '提示：長按路線即可加入收藏',
      footerAttribution:
        '資料來源：運輸署資料一線通。到站時間來自九巴、龍運、城巴、專線小巴及港鐵（包括輕鐵）；車費來自公共交通路線及收費資料。預計時間約每分鐘更新，只供參考。',
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
      locationGranted: '已取得位置',
      locationUnavailableShort: '位置不可用',
      locationBlockedHint:
        '瀏覽器已封鎖呢個網站嘅位置請求。請撳網址列嘅鎖頭／圖示，將「位置」改為「允許」或「詢問」，然後重新載入。',
      retryLocation: '再試一次',
      geoBannerTitle: '想睇附近嘅車站同路線？',
      geoBannerBody:
        '授權使用你嘅位置，我哋會列出最近嘅巴士站、港鐵站同常見路線，仲可以幫你直接跳到最近嗰個車站。',
      geoBannerCta: '啟用位置',
      geoBannerDeniedTitle: '位置被拒絕',
      geoBannerDeniedBody: '如想用附近車站功能，請喺瀏覽器設定允許位置。',
      geoBannerUnavailableTitle: '此裝置不支援定位',
      geoBannerUnavailableBody: '你仍可以輸入搜尋字眼搵路線或車站。',
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
      // Phase 18 — dedicated aria-live summary for the stop-view live
      // region. Takes (count, soonestMinutes) and emits a sentence a
      // screen-reader user can act on. Kept as a function so the
      // phrasing can localise grammar (Chinese doesn't use "in the next"
      // — the duration leads).
      ariaSummary: (count, mins) => `${count} 班車喺 ${mins} 分鐘內到站`,
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
      gmapsKeyHint:
        '用 Google Maps Embed API 嘅 key（網站 HTTP referrer 已限制）。留空就會用連結到 Google Maps 而唔係內嵌地圖。',
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
      shareLink: '分享',
      shareLinkAria: '分享連結',
      linkCopied: '已複製連結',
      qrFailed: '載入 QR Code 失敗',
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
      trafficTitle: '路面實時情況',
      trafficSub: '道路事故、改道或封路資訊',
      trafficIncident: '交通意外',
      trafficRoadwork: '道路工程',
      trafficLaneClosed: '行車線封閉',
      trafficDiversion: '改道路線',
      trafficCheckCctv: '附近 CCTV 實時影像',
      trafficLastUpdated: (h) => `最後更新：${h}`,
      serviceOperatingHours: '運行時間',
      serviceOperatingHoursEn: 'Operating hours',
      serviceDaily: '每日服務',
      serviceDailyEn: 'Daily service',
      serviceMonFri: '服務只限於星期一至五（公眾假期除外）',
      serviceMonFriEn: 'Mon–Fri only (except public holidays)',
      serviceSatSun: '服務只限於星期六、日及公眾假期',
      serviceSatSunEn: 'Sat, Sun & public holidays only',
      serviceSpecial: '特別班次',
      serviceSpecialEn: 'Special service',
      serviceMain: '主線',
      serviceMainEn: 'Main',
      serviceSpecialN: (n) => `特別班 ${n}`,
      serviceSpecialNEn: (n) => `Special ${n}`,
      serviceNoRunning: '暫無班次',
      serviceNoRunningEn: 'No service running now',
      serviceDayHint: '請留意日子',
      serviceDayHintEn: 'Check the day before travelling',
      farePerStop: '$X.X',
      fareFrom: '由 $X.X 起',
      fareTo: '至 $X.X 終',
      fareFullRange: (min, max) => `車費 $${min} – $${max}`,
      fareOctopus: '八達通',
      fareLoading: '讀取車費中…',
      fareUnavailable: '車費暫時未能提供',
      fareOrigin: '起點',
      disruptionBanner: '服務通知',
      disruptionForRoute: (route) => `路線 ${route}`,
      disruptionUntil: (until) => `至 ${until}`,
      disruptionExpand: '顯示詳情',
      disruptionCollapse: '收起',
      disruptionSeverityWarn: '班次可能受影響',
      disruptionSeveritySevere: '服務暫停或嚴重受阻',
      disruptionSeverityInfo: '服務調整',
      boundSwap: '對調方向',
      boundSwapHint: '撳一下去睇反方向嘅班次',
      boundSwapAria: '對調去程同回程',
      themeLight: '淺色',
      themeDark: '深色',
      themeSystem: '跟系統',
      themeToggleAria: '切換主題',
      settingsTitle: '設定',
      settingsTheme: '主題',
      settingsAbout: '關於',
      settingsVersion: '版本',
      settingsDataSource: '資料來源',
      settingsBackHome: '返回主頁',
      settingsEmptyStopTitle: '暫無到站時間',
      settingsEmptyStopSub: '可能係班次已過咗，試下切到時間表或者等一分鐘再睇。',
      settingsEmptyStopCtaSchedule: '睇時間表',
      settingsEmptyStopCtaRetry: '再試一次',
      refreshProgressLabel: (s) => `下次更新：${s} 秒後`,
      notifEnable: '啟用即時到站通知',
      notifThreshold: '提前通知時間',
      notifThreshold3: '3 分鐘前',
      notifThreshold5: '5 分鐘前',
      notifThreshold10: '10 分鐘前',
      notifMinutesAway: (n) => `仲有 ${n} 分鐘`,
      notifPermissionDenied: '通知已被瀏覽器封鎖。請喺瀏覽器設定允許通知，再重新整理此頁。',
      offlineMode: '離線模式',
      offlineShowingLastKnown: '顯示最後已知資料',
      vehicleMap: '實時車輛位置',
      vehicleLive: '實時 GPS 位置',
      vehicleNoData: '目前未有實時車輛位置資料。以下係根據時間表嘅預估位置。',
      vehiclePosition: '車輛位置',
      vehiclePlaceholder: '預估',
      vehicleRefreshing: '更新緊…',
      stopUnknownName: '未能識別的車站',
      stopUnknownSub: '呢個編號嘅車站搵唔到，請喺主頁搜尋你嘅目的地。',
      stopUnknownIdLabel: 'ID',
      stopUnknownCtaBack: '返回主頁',
      // v35: dimmed placeholder card on the stop view when a route serves
      // the stop yet has no upcoming arrival in the upstream horizon.
      stopNoUpcomingEta: '暫無到站時間',
      stopNoUpcomingEtaHint: '該路線暫未有實時到站資料。',
      stopNoUpcomingEtaCta: '睇時間表',
    },
    en: {
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
      operatorsNote:
        'Independent third-party app. Data published via Transport Department open data.',
      emptyRoutes: 'No saved routes yet.',
      emptyStops: 'No saved stops yet.',
      emptyRecent: 'No recent searches.',
      emptyFavRoutesCta: 'Save your favourite routes',
      emptyFavStopsCta: 'Save your favourite stops',
      emptyRecentCta: 'Start searching',
      emptyFavRoutesTip: 'Long-press the star on any route to save it',
      emptyFavStopsTip: 'Long-press the star on any stop to save it',
      emptyRecentTip: 'Searched routes and stops will appear here',
      onboardTitle: 'Welcome to BusETA HK',
      onboardLead: 'Three quick ways to get started:',
      onboardPlannerTitle: 'Plan a trip',
      onboardPlannerBody:
        'Enter an origin and a destination — fastest, cheapest, or fewest transfers.',
      onboardSearchTitle: 'Search routes & stops',
      onboardSearchBody: 'Type a route, bus stop, MTR station or place name to see live arrivals.',
      onboardNearbyTitle: 'Turn on location',
      onboardNearbyBody:
        'Once enabled, nearby bus stops, MTR stations and popular routes appear here.',
      onboardDismiss: 'Got it',
      homeEmptyTitle: 'Discover routes near you and plan your trip',
      homeEmptySearch: 'Search routes',
      homeEmptyLocate: 'Use my location',
      homeEmptyLocateUpdate: 'Update location',
      homeEmptyHot: 'Popular routes',
      homeEmptyTip: 'Tip: long-press a route to save it',
      footerAttribution:
        'Data source: Transport Department Data One. Arrivals from KMB, LWB, Citybus, Green Minibus and MTR (including Light Rail); fares from public transport data. ETAs refresh about every minute, for reference only.',
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
      locationGranted: 'Location received',
      locationUnavailableShort: 'Location unavailable',
      locationBlockedHint:
        'This site has been blocked from accessing your location. Open the address-bar lock/icon, change Location to "Allow" or "Ask", then reload.',
      retryLocation: 'Try again',
      geoBannerTitle: 'See nearby stops and routes?',
      geoBannerBody:
        'Allow location access to list the closest bus stops, MTR stations and frequent routes — and jump straight to the nearest stop.',
      geoBannerCta: 'Use my location',
      geoBannerDeniedTitle: 'Location permission denied',
      geoBannerDeniedBody:
        'Enable location in your browser settings to use the nearby stops feature.',
      geoBannerUnavailableTitle: 'Geolocation not supported',
      geoBannerUnavailableBody: 'You can still search for routes and stops above.',
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
      // Phase 18 — aria-live summary for the stop-view live region.
      // `${count} buses arriving in the next ${mins} minutes` — English
      // grammar needs the duration between the subject and the verb.
      ariaSummary: (count, mins) => `${count} buses arriving in the next ${mins} minutes`,
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
      gmapsKeyHint:
        'Use a Google Maps Embed API key (with your site URL restricted as HTTP referrer). Leave blank to fall back to opening Google Maps in a new tab.',
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
      shareLink: 'Share',
      shareLinkAria: 'Share link',
      linkCopied: 'Link copied',
      qrFailed: 'Could not load QR code',
      ctbNoEtaHint: 'Open a route to see live arrivals for this stop.',
      tabLive: 'Live',
      tabLiveEn: '即時',
      tabSchedule: 'Schedule',
      tabScheduleEn: '時間表',
      loadingSchedule: 'Loading timetable…',
      scheduleEmpty: 'No timetable data available.',
      scheduleNote:
        'Scheduled arrival times from operator open-data feeds (updated around 05:00 daily).',
      scheduleHour: (h) => `${h}:00`,
      lastBusAlert: 'Last bus has departed — no more services today',
      affectedServices: (n) => `${n} services affected`,
      noServiceAlert: 'No service running',
      dismissAlert: 'Dismiss',
      navPlanner: 'Planner',
      plannerTitle: 'Trip planner',
      plannerSubtitle:
        'Enter your origin and destination — find the fastest direct route or a quick transfer.',
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
      trafficTitle: 'Live traffic',
      trafficSub: 'Incidents, road closures and diversions',
      trafficIncident: 'Road incident',
      trafficRoadwork: 'Road works',
      trafficLaneClosed: 'Lane closed',
      trafficDiversion: 'Diversion',
      trafficCheckCctv: 'Nearby CCTV snapshots',
      trafficLastUpdated: (h) => `Last updated: ${h}`,
      serviceOperatingHours: 'Operating hours',
      serviceOperatingHoursEn: '營運時間',
      serviceDaily: 'Daily service',
      serviceDailyEn: '每日服務',
      serviceMonFri: 'Mon–Fri only (except public holidays)',
      serviceMonFriEn: '服務只限於星期一至五（公眾假期除外）',
      serviceSatSun: 'Sat, Sun & public holidays only',
      serviceSatSunEn: '服務只限於星期六、日及公眾假期',
      serviceSpecial: 'Special service',
      serviceSpecialEn: '特別班次',
      serviceMain: 'Main',
      serviceMainEn: '主線',
      serviceSpecialN: (n) => `Special ${n}`,
      serviceSpecialNEn: (n) => `特別班 ${n}`,
      serviceNoRunning: 'No service running now',
      serviceNoRunningEn: '暫無班次',
      serviceDayHint: 'Check the day before travelling',
      serviceDayHintEn: '請留意日子',
      farePerStop: '$X.X',
      fareFrom: 'From $X.X',
      fareTo: 'Up to $X.X',
      fareFullRange: (min, max) => `Fare $${min} – $${max}`,
      fareOctopus: 'Octopus',
      fareLoading: 'Loading fares…',
      fareUnavailable: 'Fares temporarily unavailable',
      fareOrigin: 'Origin',
      disruptionBanner: 'Service alert',
      disruptionForRoute: (route) => `Route ${route}`,
      disruptionUntil: (until) => `Until ${until}`,
      disruptionExpand: 'Show details',
      disruptionCollapse: 'Hide details',
      disruptionSeverityWarn: 'Service may be affected',
      disruptionSeveritySevere: 'Service suspended or severely affected',
      disruptionSeverityInfo: 'Service adjustment',
      boundSwap: 'Swap direction',
      boundSwapHint: 'Tap to view the opposite direction',
      boundSwapAria: 'Swap inbound and outbound',
      themeLight: 'Light',
      themeDark: 'Dark',
      themeSystem: 'System',
      themeToggleAria: 'Toggle theme',
      settingsTitle: 'Settings',
      settingsTheme: 'Theme',
      settingsAbout: 'About',
      settingsVersion: 'Version',
      settingsDataSource: 'Data source',
      settingsBackHome: 'Back to home',
      settingsEmptyStopTitle: 'No arrival times',
      settingsEmptyStopSub:
        'The bus may have already passed. Try the Schedule tab or wait a minute.',
      settingsEmptyStopCtaSchedule: 'View schedule',
      settingsEmptyStopCtaRetry: 'Try again',
      refreshProgressLabel: (s) => `Next refresh in ${s}s`,
      notifEnable: 'Enable arrival alerts',
      notifThreshold: 'Alert me',
      notifThreshold3: '3 min before',
      notifThreshold5: '5 min before',
      notifThreshold10: '10 min before',
      notifMinutesAway: (n) => `${n} min away`,
      notifPermissionDenied:
        'Notifications are blocked. Please allow them in your browser settings and reload.',
      offlineMode: 'Offline',
      offlineShowingLastKnown: 'showing last known data',
      vehicleMap: 'Live vehicle positions',
      vehicleLive: 'Live GPS positions',
      vehicleNoData:
        'No live GPS data available right now. Showing estimated positions based on the timetable.',
      vehiclePosition: 'Vehicle position',
      vehiclePlaceholder: 'Estimated',
      vehicleRefreshing: 'Refreshing…',
      stopUnknownName: 'Unknown stop',
      stopUnknownSub: 'We could not find a stop with this code. Try searching from the home page.',
      stopUnknownIdLabel: 'ID',
      stopUnknownCtaBack: 'Back to home',
      // v35: dimmed placeholder card on the stop view when a route serves
      // the stop yet has no upcoming arrival in the upstream horizon.
      stopNoUpcomingEta: 'No upcoming buses',
      stopNoUpcomingEtaHint: 'No live arrivals for this route right now.',
      stopNoUpcomingEtaCta: 'View schedule',
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
      emptyFavRoutesCta: '收藏常用路线',
      emptyFavStopsCta: '收藏常用车站',
      emptyRecentCta: '开始搜寻',
      emptyFavRoutesTip: '喺路线页长按星号即可加入收藏',
      emptyFavStopsTip: '喺车站页长按星号即可加入收藏',
      emptyRecentTip: '搜寻路线或车站后会自动加入呢度',
      onboardTitle: '欢迎使用 BusETA HK',
      onboardLead: '三个步骤开始你嘅第一个旅程：',
      onboardPlannerTitle: '规划行程',
      onboardPlannerBody: '输入起点同终点，搵出最快、最平或最少转乘嘅路线。',
      onboardSearchTitle: '搜寻路线同车站',
      onboardSearchBody: '输入路线、巴士站、港铁站或地点名称，搵到即时到站时间。',
      onboardNearbyTitle: '启用定位',
      onboardNearbyBody: '启用之后会显示附近嘅巴士站、港铁站同热门路线。',
      onboardDismiss: '知道了',
      homeEmptyTitle: '探索附近路线，计划你嘅行程',
      homeEmptySearch: '搜寻路线',
      homeEmptyLocate: '启用定位',
      homeEmptyLocateUpdate: '更新定位',
      homeEmptyHot: '热门路线',
      homeEmptyTip: '提示：长按路线即可加入收藏',
      footerAttribution:
        '资料来源：运输署资料一线通。到站时间嚟自九巴、龙运、城巴、专线小巴及港铁（包括轻铁）；车费嚟自公共交通路线及收费资料。预计时间约每分钟更新，只供参考。',
      searchPlaceholder: '路线、地点、车站或港铁站',
      filterAll: '全部',
      filterKMB: '九巴',
      filterLWB: '龙运',
      filterCTB: '城巴',
      filterGMB: '小巴',
      filterMTR: '港铁',
      nearbyRoutes: '附近路线',
      nearbyStops: '附近车站',
      nearbyStations: '附近港铁站',
      dirUp: '上行',
      dirDown: '下行',
      inbound: '去程',
      outbound: '回程',
      line: '路线',
      platform: '月台',
      trains: '班列车',
      station: '车站',
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
      // Phase 18 — aria-live summary for the stop-view live region.
      // Mirrors the zh-Hant structure (count + duration leads).
      ariaSummary: (count, mins) => `${count} 班车在 ${mins} 分钟内到站`,
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
      noResults: '找不到相关的路线、车站或港铁站。',
      back: '返回',
      route: '路线',
      stop: '车站',
      to: '→',
      selectStation: '揾该站',
      loadingRoutes: '揾紧小巴路线…',
      gmbProgress: (done, total) => `已载入 ${done}/${total} 条小巴路线`,
      fetchFailed: '载入唔到，揫一下。',
      openInMaps: '喺 Google Maps 开启',
      mapHeader: '地图',
      settingsTitle: '设定',
      gmapsKeyLabel: 'Google Maps API key',
      gmapsKeyHint:
        '用 Google Maps Embed API 嘅 key（网站 HTTP referrer 已限制）。留空就会用连结去 Google Maps 而唔系内嵌地图。',
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
      shareLink: '分享',
      shareLinkAria: '分享链接',
      linkCopied: '已复制链接',
      qrFailed: '载入 QR Code 失败',
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
      geoBannerBody:
        '授权使用你嘅位置，我哋会列出最近嘅巴士站、港铁站同常见路线，仲可以帮你直接跳到最近嗰个车站。',
      geoBannerCta: '启用位置',
      geoBannerDeniedTitle: '位置被拒绝',
      geoBannerDeniedBody: '如想用附近车站功能，请喺浏览器设定允许位置。',
      geoBannerUnavailableTitle: '此装置不支援定位',
      geoBannerUnavailableBody: '你仍然可以输入搜寻字眼搵路线或车站。',
      locating: '定位中…',
      locationDenied: '定位被拒绝，未能取得附近路线。',
      locationUnavailable: '未能取得位置，未能提供附近路线。',
      locationGranted: '已取得位置',
      locationUnavailableShort: '位置不可用',
      locationBlockedHint:
        '浏览器已封锁此网站的位置请求。请点击网址栏的锁头／图标，将「位置」改为「允许」或「询问」，然后重新载入。',
      retryLocation: '再试一次',
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
      trafficTitle: '路面实时情况',
      trafficSub: '道路事故、改道或封路资讯',
      trafficIncident: '交通意外',
      trafficRoadwork: '道路工程',
      trafficLaneClosed: '行车线封闭',
      trafficDiversion: '改道路线',
      trafficCheckCctv: '附近 CCTV 实时影像',
      trafficLastUpdated: (h) => `最后更新：${h}`,
      serviceOperatingHours: '运行时间',
      serviceOperatingHoursEn: 'Operating hours',
      serviceDaily: '每日服务',
      serviceDailyEn: 'Daily service',
      serviceMonFri: '服务只限于星期一至五（公众假期除外）',
      serviceMonFriEn: 'Mon–Fri only (except public holidays)',
      serviceSatSun: '服务只限于星期六、日及公众假期',
      serviceSatSunEn: 'Sat, Sun & public holidays only',
      serviceSpecial: '特别班次',
      serviceSpecialEn: 'Special service',
      serviceMain: '主线',
      serviceMainEn: 'Main',
      serviceSpecialN: (n) => `特别班 ${n}`,
      serviceSpecialNEn: (n) => `Special ${n}`,
      serviceNoRunning: '暂无班次',
      serviceNoRunningEn: 'No service running now',
      serviceDayHint: '请留意日子',
      serviceDayHintEn: 'Check the day before travelling',
      farePerStop: '$X.X',
      fareFrom: '由 $X.X 起',
      fareTo: '至 $X.X 终',
      fareFullRange: (min, max) => `车费 $${min} – $${max}`,
      fareOctopus: '八达通',
      fareLoading: '读取车费中…',
      fareUnavailable: '车费暂时未能提供',
      fareOrigin: '起点',
      disruptionBanner: '服务通知',
      disruptionForRoute: (route) => `路线 ${route}`,
      disruptionUntil: (until) => `至 ${until}`,
      disruptionExpand: '显示详情',
      disruptionCollapse: '收起',
      disruptionSeverityWarn: '班次可能受影响',
      disruptionSeveritySevere: '服务暂停或严重受阻',
      disruptionSeverityInfo: '服务调整',
      boundSwap: '对调方向',
      boundSwapHint: '按一下睇反方向嘅班次',
      boundSwapAria: '对调去程同回程',
      themeLight: '浅色',
      themeDark: '深色',
      themeSystem: '跟系统',
      themeToggleAria: '切换主题',
      settingsTitle: '设定',
      settingsTheme: '主题',
      settingsAbout: '关于',
      settingsVersion: '版本',
      settingsDataSource: '资料来源',
      settingsBackHome: '返回主页',
      settingsEmptyStopTitle: '暂无到站时间',
      settingsEmptyStopSub: '可能系班次已过咗，试下切到时间表或者等一分钟再睇。',
      settingsEmptyStopCtaSchedule: '睇时间表',
      settingsEmptyStopCtaRetry: '再试一次',
      refreshProgressLabel: (s) => `下次更新：${s} 秒后`,
      notifEnable: '启用实时到站通知',
      notifThreshold: '提前通知时间',
      notifThreshold3: '3 分钟前',
      notifThreshold5: '5 分钟前',
      notifThreshold10: '10 分钟前',
      notifMinutesAway: (n) => `仲有 ${n} 分钟`,
      notifPermissionDenied: '通知已被浏览器封锁。请喺浏览器设定允许通知，再重新整理此页。',
      offlineMode: '离线模式',
      offlineShowingLastKnown: '显示最后已知资料',
      vehicleMap: '实时车辆位置',
      vehicleLive: '实时 GPS 位置',
      vehicleNoData: '目前未有实时车辆位置资料。以下系根据时间表嘅预估位置。',
      vehiclePosition: '车辆位置',
      vehiclePlaceholder: '预估',
      vehicleRefreshing: '更新紧…',
      stopUnknownName: '未能识别的车站',
      stopUnknownSub: '呢个编号嘅车站揫唔到，请喺主页搜寻你嘅目的地。',
      stopUnknownIdLabel: 'ID',
      stopUnknownCtaBack: '返回主页',
      // v35: dimmed placeholder card on the stop view when a route serves
      // the stop yet has no upcoming arrival in the upstream horizon.
      stopNoUpcomingEta: '暂无到站时间',
      stopNoUpcomingEtaHint: '该路线暂无实时到站资料。',
      stopNoUpcomingEtaCta: '睇时间表',
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
    // v45 — curated LRT stop lat/lng. lrt-routes.json has route + stop
    // names but no coordinates; this file bridges that gap so the trip
    // planner can compute km for LRT ride legs (railRoute() uses the
    // same haversine helper MTR ride legs use).
    LRT_STOPS: 'assets/lrt-stops.json?v=1',
  };

  const STORAGE_KEYS = {
    LANG: 'buseta.lang',
    THEME: 'buseta.theme',
    ROUTES: 'buseta.saved.routes',
    STOPS: 'buseta.saved.stops',
    RECENT: 'buseta.recent',
    INDEX: 'buseta.index',
    INDEX_TS: 'buseta.index.ts',
    INDEX_VER: 'buseta.index.ver',
    GMB_LIST: 'buseta.gmb.list',
    GMB_LIST_TS: 'buseta.gmb.list.ts',
    GMB_PROGRESS: 'buseta.gmb.progress',
    // Phase 14 — persisted snapshot of the prefetched /route-stop map so
    // repeat visits can serve via-stops without re-paying the 75s prefetch
    // (and the network) once the SW 24h TTL has expired.
    ROUTE_STOPS: 'buseta.route.stops',
    ROUTE_STOPS_TS: 'buseta.route.stops.ts',
    GMAPS_KEY: 'buseta.gmapsKey',
    CONFIG: 'assets/config.json',
    META: 'buseta.meta',
    OFFLINE: 'buseta.offline',
    NOTIF_ENABLED: 'buseta.notif.enabled',
    NOTIF_THRESHOLD: 'buseta.notif.threshold',
    ONBOARDED: 'buseta.onboarded',
  };

  // ------------------------------------------------------------------
  // Theme
  // ------------------------------------------------------------------
  // Allowed stored values: 'dark' | 'light' | 'system'. Anything else
  // (including legacy null) is treated as 'system' so the user's OS
  // preference drives first paint.
  const VALID_THEMES = new Set(['dark', 'light', 'system']);
  const systemPrefersLight = () => {
    try {
      return window.matchMedia('(prefers-color-scheme: light)').matches;
    } catch {
      return false;
    }
  };
  // Resolve a stored preference to the effective on-the-wire theme
  // ('dark' or 'light'). 'system' falls through to matchMedia.
  function effectiveTheme(stored) {
    const t = VALID_THEMES.has(stored) ? stored : 'system';
    if (t === 'system') return systemPrefersLight() ? 'light' : 'dark';
    return t;
  }
  // Apply a stored preference. With 'system', we leave the data-theme
  // attribute unset so the CSS media query takes over; with an explicit
  // choice, we set data-theme directly. The inline loader in index.html
  // mirrors this so first paint never flashes the wrong palette.
  function setTheme(stored) {
    const t = VALID_THEMES.has(stored) ? stored : 'system';
    if (t === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
    // Reflect the *stored* choice (not the resolved colour) on the
    // toggle so the icon shows whether the user is on auto vs explicit.
    const btn = document.getElementById('themeToggle');
    if (btn) btn.setAttribute('data-mode', t);
    // The <meta name="theme-color"> tags already branch by
    // prefers-color-scheme for the browser chrome, so we don't need to
    // touch them here.
  }
  // Cycle: dark → light → system → dark. Persists to localStorage.
  function cycleTheme() {
    const cur = (() => {
      try {
        const v = localStorage.getItem(STORAGE_KEYS.THEME);
        return VALID_THEMES.has(v) ? v : 'system';
      } catch {
        return 'system';
      }
    })();
    const next = cur === 'dark' ? 'light' : cur === 'light' ? 'system' : 'dark';
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, next);
    } catch {}
    setTheme(next);
  }
  function loadThemePreference() {
    let stored;
    try {
      stored = localStorage.getItem(STORAGE_KEYS.THEME);
    } catch {
      stored = null;
    }
    // Normalise legacy / missing values to 'system' so the CSS media
    // query handles the visual choice on first load.
    const t = VALID_THEMES.has(stored) ? stored : 'system';
    setTheme(t);
  }

  // Bump this whenever the on-disk shape of the index changes, so old
  // cached snapshots get discarded and rebuilt against the live APIs.
  // v4: index entries now carry `co` (KMB / MTR / GMB) so list rows render
  // a proper operator badge instead of the generic STOP placeholder.
  const INDEX_SCHEMA_VERSION = 5; // v45 — adds lat/lng to lrt.stops

  const REFRESH_INTERVAL_MS = 60_000;
  const INDEX_MAX_AGE_MS = 12 * 60 * 60 * 1000;
  const GMB_LIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const GMB_INDEX_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  // ------------------------------------------------------------------
  // Offline state
  //   Mirrors `navigator.onLine` but persists across reloads via
  //   localStorage so a user who closed the tab offline and reopens
  //   it offline still sees the banner without a one-frame flicker.
  //   Held in a module-local closure (NOT on `state`) to avoid
  //   widening the shared state shape that the planner reads.
  // ------------------------------------------------------------------
  let isOffline = false;
  function readOfflineFlag() {
    try {
      return localStorage.getItem(STORAGE_KEYS.OFFLINE) === '1';
    } catch {
      return false;
    }
  }
  function writeOfflineFlag(next) {
    try {
      if (next) localStorage.setItem(STORAGE_KEYS.OFFLINE, '1');
      else localStorage.removeItem(STORAGE_KEYS.OFFLINE);
    } catch {
      /* private mode etc. */
    }
  }
  function setOffline(next) {
    const flag = !!next;
    if (isOffline === flag) return;
    isOffline = flag;
    writeOfflineFlag(flag);
    // Re-render the home view only when it's the active screen.
    try {
      if (typeof currentRoute === 'function' && currentRoute() === 'home') {
        renderHome();
      }
    } catch {
      /* currentRoute / renderHome may not be defined yet */
    }
  }

  // ------------------------------------------------------------------
  // Module-level caches
  // ------------------------------------------------------------------
  // Per-stop schedule cache. The schedule view reuses these so re-visits
  // are instant without re-hitting the operator APIs.
  const scheduleCache = new Map();

  // Per-route fare cache. Keyed by `${co}/${route}/${dir}/${service}` so
  // re-renders within a session don't re-hit the operator fare endpoints.
  // Value is `Map<seq, fare>` (front_board fare per stop seq) or `null`
  // when the operator doesn't expose per-stop fares / the fetch failed —
  // the per-stop pill then hides rather than ship an empty placeholder.
  const routeFareCache = new Map();

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
    // Vehicle-map auto-refresh timer + the AbortController for any
    // in-flight upstream position fetch. Both cleared when the user
    // navigates away from the route detail (see stopVehicleRefresh).
    vehicleTimer: null,
    vehicleAbort: null,
    // Local-notification system (Web Notification API — fires while the
    // tab is open, since the static GitHub Pages site has no backend to
    // push via VAPID). Persistence is in localStorage; the rest of the
    // state here is in-memory only.
    notifEnabled: false,
    notifThresholdMin: 5,
    notifTimer: null,
    notifInFlight: false,
    // Edge-detection map: per (stopId, co, route, dir, serviceType) we
    // remember whether the soonest ETA was above ('above') or at/below
    // ('below') the threshold on the last poll. A notification only
    // fires on the above → below transition, so we never spam the user
    // on every 20s tick even when the ETA stays under threshold.
    notifEdge: new Map(),
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
      else if (k.startsWith('on') && typeof v === 'function')
        node.addEventListener(k.slice(2).toLowerCase(), v);
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

  // KMB embeds the operator-facing stop code in each stop's name as a
  // trailing "(ST905)" / "(PA100)" / "(LS001)" suffix in both Chinese and
  // English. Strip that suffix for display; keep the operator code itself
  // for the `kmbOperatorId` reverse-lookup table built in buildIndex().
  // stripKmbOpSuffix moved to src/utils/text.js — Phase 5 modularization

  // Pick a stop / route name in the current UI language. Falls back to the
  // other Chinese variant (tc ↔ sc) if the requested variant is empty, then
  // to English. Operator APIs return `name_tc` / `name_sc` / `name_en`.
  // pickName moved to src/utils/text.js — Phase 5 modularization

  // Convenience: pick a stop / route name in the *current* UI language.
  // Wraps `busetaUtils.pickName(obj, state.lang)` for the common case.
  function nameFor(obj) {
    return busetaUtils.pickName(obj, state.lang);
  }

  const makeRouteKey = (co, route, dir, service) => `${co}|${route}|${dir}|${service}`;
  const sameRoute = (a, b) =>
    a.co === b.co && a.route === b.route && a.dir === b.dir && a.service === b.service;
  const sameStop = (a, b) =>
    String(a.stop) === String(b.stop) && (a.co || 'STOP') === (b.co || 'STOP');

  // classifyKmbOp / opCoKey moved to src/utils/operators.js — Phase 4 modularization

  // ------------------------------------------------------------------
  // Persistence
  // ------------------------------------------------------------------
  const storage = {
    get(key, fallback) {
      try {
        const v = JSON.parse(localStorage.getItem(key));
        return v == null ? fallback : v;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    },
  };

  function loadState() {
    state.lang = storage.get(STORAGE_KEYS.LANG, 'zh-Hant');
    state.savedRoutes = storage.get(STORAGE_KEYS.ROUTES, []);
    state.savedStops = storage.get(STORAGE_KEYS.STOPS, []);
    state.recent = storage.get(STORAGE_KEYS.RECENT, []);
    const thresh = storage.get(STORAGE_KEYS.NOTIF_THRESHOLD, 5);
    state.notifThresholdMin = [3, 5, 10].includes(Number(thresh)) ? Number(thresh) : 5;
    // Only mark notifications enabled when the API exists AND the
    // browser still has the user-granted permission. If the user
    // revoked permission since the last visit, drop the stale flag so
    // the settings UI flips back to the disabled state and we don't try
    // to fire on `permission === 'denied'` (which throws).
    const wantsNotif = storage.get(STORAGE_KEYS.NOTIF_ENABLED, false);
    state.notifEnabled =
      !!wantsNotif && typeof Notification !== 'undefined' && Notification.permission === 'granted';
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
      // operator_id → { internalId, nameTc, nameEn, nameSc, lat, lng }
      // KMB's open-data feeds use internal 16-hex IDs (`9F542D4B6CF41651`)
      // for `/stop/{id}` but the operator-facing ID (`ST905`) is what users
      // see on bus stop signs. The only place the operator code is exposed
      // publicly is in each stop's name_tc as a trailing `(ST905)` suffix,
      // so we parse it once at index-build time and keep the reverse map
      // for direct `/stop/<operator-id>` navigation.
      kmbOperatorId: new Map(raw.kmbOperatorId || []),
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
      kmbOperatorId: idx.kmbOperatorId ? Array.from(idx.kmbOperatorId.entries()) : [],
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
    const [kmbRoutes, kmbStops, ctbRoutes, mtrLines, lrtRoutes, lrtStops, hkStops, mtrStops] =
      await Promise.all([
        busetaUtils.fetchJSON(`${API.KMB}/route/`).catch(() => null),
        busetaUtils.fetchJSON(`${API.KMB}/stop/`).catch(() => null),
        busetaUtils.fetchJSON(`${API.CITYBUS}/route/ctb`).catch(() => null),
        busetaUtils.fetchJSON(API.MTR_LINES).catch(() => null),
        busetaUtils.fetchJSON(API.LRT_ROUTES).catch(() => null),
        // v45 — LRT stop coordinates; merged into lrt.stops below so the
        // planner's railRoute() haversine helper can compute km for LRT
        // ride legs. Best-effort: missing file or shape just leaves lat
        // null (legacy behaviour: leg meters fall back to 0).
        busetaUtils.fetchJSON(API.LRT_STOPS).catch(() => null),
        busetaUtils.fetchJSON(API.HK_STOPS).catch(() => null),
        busetaUtils.fetchJSON(API.MTR_STOPS).catch(() => null),
      ]);

    const routes = new Map();
    const stops = new Map();
    const ctb = new Map();
    const mtr = new Map();
    const lrt = { routes: new Map(), stops: new Map(), platforms: new Map() };
    // KMB operator-facing stop code → internal-ID reverse map. Built from
    // the `(ST905)` / `(PA100)` suffix on each KMB stop's name_tc — the
    // only public signal KMB exposes that links operator IDs to internal
    // IDs and stop names.
    const kmbOperatorId = new Map();

    // ---- KMB / LWB ----
    if (kmbRoutes && Array.isArray(kmbRoutes.data)) {
      for (const r of kmbRoutes.data) {
        const key = makeRouteKey('KMB', r.route, r.bound, r.service_type);
        const op = busetaUtils.classifyKmbOp(r.route, r.orig_tc || '', r.dest_tc || '');
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
        // Tag every KMB stop with its operator so list rows render a proper
        // operator badge instead of falling back to the generic STOP placeholder
        // (which used to ship as a stray "·" character before the stop name).
        stops.set(s.stop, {
          stop: s.stop,
          co: 'KMB',
          nameTc: s.name_tc,
          nameSc: s.name_sc || '',
          nameEn: s.name_en,
          lat: parseFloat(s.lat),
          lng: parseFloat(s.long),
        });
        // KMB stop names carry the operator-facing stop code as a trailing
        // `(ST905)` suffix (cn) / `(ST905)` suffix (en) — parse it once so
        // we can resolve `#/stop/ST905` direct-nav without round-tripping
        // to upstream (which only accepts the internal 16-hex ID anyway).
        const opMatch = (s.name_tc || '').match(/\(([A-Z][A-Z0-9]{1,5})\)\s*$/);
        const opId = opMatch ? opMatch[1] : null;
        if (opId && !kmbOperatorId.has(opId)) {
          kmbOperatorId.set(opId, {
            internalId: s.stop,
            nameTc: busetaUtils.stripKmbOpSuffix(s.name_tc),
            nameEn: busetaUtils.stripKmbOpSuffix(s.name_en),
            nameSc: busetaUtils.stripKmbOpSuffix(s.name_sc || ''),
            lat: parseFloat(s.lat),
            lng: parseFloat(s.long),
          });
        }
      }
    }

    // ---- Citybus (CTB + NWFB) ----
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
          // Best-effort operator tag for the curated hk-stops.json entries so
          // they get a proper operator badge in list rows instead of the
          // generic STOP placeholder. The hk-stops.json catalogue is
          // (mostly) MTR stations by alphabetic code + GMB / NLB stops by
          // numeric ID; LRT stops live in `state.index.lrt.stops` and are
          // not duplicated here.
          const co = /^[A-Za-z]{3,4}$/.test(id) ? 'MTR' : 'GMB';
          stops.set(id, {
            stop: id,
            co,
            nameTc: info.zh || '',
            nameEn: info.en || '',
            lat,
            lng,
          });
        }
      }
    }

    // ---- MTR heavy rail (parse line_stations grid → StationIndex → Join with mtr-stops.json coords) ----
    if (mtrLines && Array.isArray(mtrLines)) {
      const lineNames = {
        AEL: { zh: '機場快綫', en: 'Airport Express' },
        TCL: { zh: '東涌綫', en: 'Tung Chung Line' },
        TKL: { zh: '將軍澳綫', en: 'Tseung Kwan O Line' },
        TML: { zh: '屯馬綫', en: 'Tuen Ma Line' },
        EAL: { zh: '東鐵綫', en: 'East Rail Line' },
        SIL: { zh: '南港島綫', en: 'South Island Line' },
        TWL: { zh: '荃灣綫', en: 'Tsuen Wan Line' },
        ISL: { zh: '港島綫', en: 'Island Line' },
        KTL: { zh: '觀塘綫', en: 'Kwun Tong Line' },
        DRL: { zh: '迪士尼綫', en: 'Disneyland Resort Line' },
      };
      const seenStations = new Map();
      for (const row of mtrLines) {
        const lineCode = row.line,
          direction = row.dir,
          stationCode = row.station;
        if (!lineCode || !stationCode) continue;
        const lineLabel = lineNames[lineCode] || { zh: lineCode, en: lineCode };

        const routeKey = `MTR|${lineCode}`;
        if (!mtr.has(routeKey)) {
          mtr.set(routeKey, {
            co: 'MTR',
            route: lineCode,
            dir: '',
            service: '',
            origTc: lineLabel.zh,
            origEn: lineLabel.en,
            destTc: lineLabel.zh,
            destEn: lineLabel.en,
            _isLine: true,
            _directions: new Set(),
          });
        }
        mtr.get(routeKey)._directions.add(direction);

        const coordInfo = (mtrStops && mtrStops[stationCode]) || null;
        const lat = coordInfo ? Number(coordInfo.lat) : NaN;
        const lng = coordInfo ? Number(coordInfo.lng) : NaN;
        if (!seenStations.has(stationCode)) {
          seenStations.set(stationCode, {
            co: 'MTR',
            stop: stationCode,
            nameTc: row.zh,
            nameEn: row.en,
            lat: Number.isFinite(lat) ? lat : null,
            lng: Number.isFinite(lng) ? lng : null,
            lines: [lineCode],
            _dirs: [direction],
            _seq: row.seq || 0,
          });
        } else {
          const st = seenStations.get(stationCode);
          if (!st.lines.includes(lineCode)) st.lines.push(lineCode);
          if (!st._dirs.includes(direction)) st._dirs.push(direction);
          if ((!Number.isFinite(st.lat) || st.lat == null) && Number.isFinite(lat)) {
            st.lat = lat;
            st.lng = lng;
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
        const routeNo = row.route,
          dir = row.dir,
          stopCode = row.stop;
        if (!routeNo || !stopCode) continue;
        const routeKey = `LRT|${routeNo}`;
        if (!routeMeta.has(routeKey)) {
          routeMeta.set(routeKey, {
            co: 'LRT',
            route: routeNo,
            dir: '',
            service: '',
            origTc: '',
            origEn: '',
            destTc: '',
            destEn: '',
            _dirs: new Set(),
            _stops: [],
          });
        }
        const meta = routeMeta.get(routeKey);
        meta._dirs.add(dir);
        meta._stops.push({ stop: stopCode, dir, seq: row.seq || 0, id: row.id });

        if (!stopMeta.has(stopCode)) {
          stopMeta.set(stopCode, {
            co: 'LRT',
            stop: stopCode,
            nameTc: row.zh,
            nameEn: row.en,
            id: row.id,
            _routes: new Set(),
          });
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
        // v45 — overlay lat/lng from the curated lrt-stops.json so the
        // trip planner's haversine helper can compute km for LRT ride
        // legs (railRoute()). Missing entries fall back to null and
        // degrade gracefully to 0m on the badge.
        if (lrtStops && typeof lrtStops === 'object') {
          const coord = lrtStops[st.stop];
          if (coord) {
            const lat = Number(coord.lat);
            const lng = Number(coord.lng);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              st.lat = lat;
              st.lng = lng;
            }
          }
        }
        lrt.stops.set(st.stop, st);
      }
    }

    state.index = { routes, stops, ctbRoutes: ctb, mtr, lrt, kmbOperatorId };
    storage.set(STORAGE_KEYS.INDEX, dehydrateIndex(state.index));
    storage.set(STORAGE_KEYS.INDEX_TS, Date.now());
    storage.set(STORAGE_KEYS.INDEX_VER, INDEX_SCHEMA_VERSION);

    // Restore previously-persisted /route-stop snapshot so via-stops are
    // visible immediately on repeat visits (within ROUTE_STOPS_MAX_AGE),
    // even after the SW 24h TTL has expired. The prefetcher (Phase 12)
    // then top-ups any routes that are missing or stale since the last
    // save.
    restoreRouteStopsFromStorage();

    // Kick off GMB route list build in the background.
    ensureGmbList().catch(() => {});

    // Kick off /route-stop prefetch so via-stops light up gradually
    // (Phase 12). Fire-and-forget: failures are per-route and don't
    // affect the loadIndex() return value. Results land in
    // state.routeStopsByRoute + state.routesByStop; refreshBusStopView
    // picks them up on the next render.
    prefetchRouteStops().catch(() => {});

    return state.index;
  }

  // ------------------------------------------------------------------
  // Prefetch: /route-stop for every KMB / LWB / CTB / NWFB route
  //   v53 (Phase 12). Resolves TODO(v38) for via-stops lookup by
  //   populating state.routeStopsByRoute with each route's stop list.
  //   Concurrency-capped at 8 so we don't hammer upstream during cold
  //   load (3000+ routes × ~200ms ÷ 8 ≈ 75s wall-clock; SW caches each
  //   response for 24h so the second visit is O(1)).
  //
  //   Each successful fetch incrementally rebuilds state.routesByStop
  //   via busetaUtils.buildRoutesByStopMap — small rebuilds keep the
  //   reverse lookup fresh as data arrives. Failures are tolerated
  //   (just skip the route); the live panel falls back to the terminus
  //   scan via busetaUtils.findRoutesServingStop({..., terminusMatches}).
  // ------------------------------------------------------------------
  function routeKey(r) {
    return `${r.co}|${r.route}|${r.dir}|${r.service}`;
  }

  // Phase 14 — localStorage persistence for the prefetched route-stops
  // snapshot. Repeat visits within ROUTE_STOPS_MAX_AGE avoid re-paying
  // the 75s prefetch (and any upstream 4xx/5xx the prefetcher swallows)
  // by restoring the cached state immediately. The persisted snapshot
  // lives across the SW 24h TTL — it's the longer-lived layer.
  const ROUTE_STOPS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  // Serialize state.routeStopsByRoute + state.routesByStop into a
  // JSON-safe form. Both are Map<_, Array<_>> / Map<_, Set<_>> so we
  // round-trip via Array.from(entries) and an inner Array.from(set)
  // for the Set values. Round-trippable by rehydrateRouteStops.
  function dehydrateRouteStops() {
    if (!state.routeStopsByRoute || !state.routesByStop) return null;
    return {
      // Map<routeKey, Array<stopInfo>> → [[routeKey, stopInfo[]], ...]
      r: Array.from(state.routeStopsByRoute.entries()),
      // Map<stopName, Set<routeInfo>> → [[stopName, routeInfo[]], ...]
      s: Array.from(state.routesByStop.entries()).map(([k, set]) => [k, Array.from(set)]),
    };
  }

  function rehydrateRouteStops(raw) {
    if (!raw || typeof raw !== 'object') return false;
    const rMap = new Map();
    if (Array.isArray(raw.r)) {
      for (const [k, stops] of raw.r) {
        if (typeof k === 'string' && Array.isArray(stops)) rMap.set(k, stops);
      }
    }
    const sMap = new Map();
    if (Array.isArray(raw.s)) {
      for (const [k, arr] of raw.s) {
        if (typeof k === 'string' && Array.isArray(arr)) sMap.set(k, new Set(arr));
      }
    }
    state.routeStopsByRoute = rMap;
    state.routesByStop = sMap;
    return rMap.size > 0 || sMap.size > 0;
  }

  // Pull the persisted snapshot back into state on boot, if it's recent
  // enough. Returns true on a successful restore.
  function restoreRouteStopsFromStorage() {
    const ts = storage.get(STORAGE_KEYS.ROUTE_STOPS_TS, 0);
    if (!ts || Date.now() - ts > ROUTE_STOPS_MAX_AGE_MS) return false;
    const raw = storage.get(STORAGE_KEYS.ROUTE_STOPS, null);
    if (!raw) return false;
    try {
      return rehydrateRouteStops(raw);
    } catch (_) {
      return false;
    }
  }

  // Debounced saver — called from inside prefetchRouteStops after every
  // successful fetch. Coalesces 3000+ small writes into a handful of
  // localStorage.setItem calls per cold load.
  let _saveRouteStopsTimer = null;
  function schedulePersistRouteStops() {
    if (_saveRouteStopsTimer) return;
    _saveRouteStopsTimer = setTimeout(() => {
      _saveRouteStopsTimer = null;
      try {
        const raw = dehydrateRouteStops();
        if (!raw) return;
        storage.set(STORAGE_KEYS.ROUTE_STOPS, raw);
        storage.set(STORAGE_KEYS.ROUTE_STOPS_TS, Date.now());
      } catch (_) {
        /* quota / serialization — ignore */
      }
    }, 2000);
  }
  // Final flush on page-hide so we don't lose progress when the user
  // closes the tab mid-prefetch (cold-load scenario).
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pagehide', () => {
      if (!_saveRouteStopsTimer) return;
      clearTimeout(_saveRouteStopsTimer);
      _saveRouteStopsTimer = null;
      try {
        const raw = dehydrateRouteStops();
        if (!raw) return;
        storage.set(STORAGE_KEYS.ROUTE_STOPS, raw);
        storage.set(STORAGE_KEYS.ROUTE_STOPS_TS, Date.now());
      } catch (_) {
        /* ignore */
      }
    });
  }

  async function prefetchRouteStops() {
    if (!state.index) return;
    if (state.routeStopsByRoute && state.routeStopsByRoute.size > 0) return; // already restored
    const routes = Array.from(state.index.routes.values()).concat(
      Array.from(state.index.ctbRoutes.values())
    );
    // Same filter as findTerminusRoutesForStop — KMB / LWB / CTB / NWFB
    // only. GMB / LRT / MTR are excluded (different stop enumeration
    // model; their routes never serve a KMB-style 巴士總站).
    const candidates = routes.filter(
      (r) => r.co === 'KMB' || r.co === 'LWB' || r.co === 'CTB' || r.co === 'NWFB'
    );
    if (candidates.length === 0) return;

    // If we restored from localStorage, top-up only the missing routes
    // (Phase 14). Otherwise start empty.
    if (!state.routeStopsByRoute) state.routeStopsByRoute = new Map();
    if (!state.routesByStop) state.routesByStop = new Map();
    const seen = new Set(state.routeStopsByRoute.keys());

    await busetaUtils.mapWithCap(candidates, 8, async (r) => {
      const key = routeKey(r);
      if (seen.has(key)) return null; // already restored
      let raw;
      try {
        raw =
          r.co === 'KMB' || r.co === 'LWB'
            ? await fetchKmbRouteStop(r.route, r.dir, r.service)
            : await fetchCtbRouteStop(r.route, r.dir);
      } catch (_) {
        return null;
      }
      const arr = Array.isArray(raw && raw.data) ? raw.data : [];
      const stops = arr
        .map((it) => ({
          stop: String(it.stop),
          seq: parseInt(it.seq, 10),
          nameTc: it.name_tc || '',
          nameEn: it.name_en || '',
        }))
        .filter((x) => Number.isFinite(x.seq));
      state.routeStopsByRoute.set(key, stops);
      // Incremental rebuild — keep state.routesByStop current as data
      // arrives. Cheap (typically <100µs per route).
      const merged = busetaUtils.buildRoutesByStopMap(new Map([[key, r]]), new Map([[key, stops]]));
      for (const [stopName, set] of merged.entries()) {
        if (!state.routesByStop.has(stopName)) state.routesByStop.set(stopName, new Set());
        for (const item of set) state.routesByStop.get(stopName).add(item);
      }
      // Debounced save — coalesces 3000+ small writes into a handful of
      // localStorage.setItem calls per cold load.
      schedulePersistRouteStops();
      return key;
    });
    // Final flush once the prefetch completes so the snapshot is up to
    // date regardless of the debounce window.
    if (_saveRouteStopsTimer) {
      clearTimeout(_saveRouteStopsTimer);
      _saveRouteStopsTimer = null;
    }
    try {
      const raw = dehydrateRouteStops();
      if (raw) {
        storage.set(STORAGE_KEYS.ROUTE_STOPS, raw);
        storage.set(STORAGE_KEYS.ROUTE_STOPS_TS, Date.now());
      }
    } catch (_) {
      /* ignore */
    }
  }

  // Light CSV parser for the MTR/LRT files: handles quoted fields with commas.
  // parseCsvLine moved to src/utils/text.js — Phase 5 modularization

  // fetchJSON / fetchText moved to src/utils/network.js — Phase 4 modularization

  const fetchKmbRouteStop = (route, dir, service) =>
    busetaUtils.fetchJSON(
      `${API.KMB}/route-stop/${encodeURIComponent(route)}/${dir === 'I' ? 'inbound' : 'outbound'}/${encodeURIComponent(service)}`
    );
  // CTB / NWFB share the Citybus endpoint shape (service type defaults to 1
  // for both — these operators don't expose per-service variants). Used by
  // prefetchRouteStops() in Phase 12.
  const fetchCtbRouteStop = (route, dir) =>
    busetaUtils.fetchJSON(
      `${API.CITYBUS}/route-stop/ctb/${encodeURIComponent(route)}/${dir === 'I' ? 'inbound' : 'outbound'}`
    );
  const fetchKmbStop = (stopId) =>
    busetaUtils.fetchJSON(`${API.KMB}/stop/${encodeURIComponent(stopId)}`);
  const fetchKmbStopEta = (stopId) =>
    busetaUtils.fetchJSON(`${API.KMB}/stop-eta/${encodeURIComponent(stopId)}`);
  // Per-stop section fares for KMB / LWB (same endpoint). Returns a
  // Map<seq, fare>, a flat number, or null on failure. The upstream
  // /route-fare endpoint returns per-stop seq fares (`front_board` is the
  // fare a passenger pays when boarding at that stop and riding to the
  // route terminus). When upstream is dead (HTTP 422 — verified Oct 2026),
  // fall back to the hand-curated assets/kmb-fares.json (50 most-common
  // KMB routes from the post-2024 fare_increment page). The JSON fallback
  // returns a flat single-route fare which `expandFareForStops` (in the
  // route-detail caller) spreads across every seq — same UX as CTB.
  const fetchKmbRouteFare = async (route, dir, service) => {
    const cacheKey = `KMB/${route}`;
    if (_fareFlatCache.has(cacheKey)) return _fareFlatCache.get(cacheKey);
    let map = null;
    let flat = null;
    try {
      const dirSeg = dir === 'I' ? 'inbound' : 'outbound';
      const resp = await busetaUtils.fetchJSON(
        `${API.KMB}/route-fare/${encodeURIComponent(route)}/${dirSeg}/${encodeURIComponent(service)}`
      );
      const arr = resp && Array.isArray(resp.data) ? resp.data : [];
      if (arr.length > 0) {
        map = new Map();
        for (const it of arr) {
          const seq = parseInt(it.seq, 10);
          if (!Number.isFinite(seq)) continue;
          // Prefer front_board; fall back to rear_board when upstream is sparse.
          const fare =
            it.front_board != null && it.front_board !== ''
              ? it.front_board
              : it.rear_board != null && it.rear_board !== ''
                ? it.rear_board
                : null;
          if (fare != null) map.set(seq, fare);
        }
        if (map.size === 0) map = null;
      }
    } catch (e) {
      map = null;
    }
    if (!map) {
      // Hardcoded fallback: assets/kmb-fares.json — KMB's official
      // fare_increment page publishes a flat Octopus fare per route;
      // the file is keyed by route number with `{co: 'KMB', fare, octopus}`.
      try {
        const all = await busetaUtils.fetchJSON(`assets/kmb-fares.json`);
        const entry = (all && all[route]) || null;
        const f =
          entry && Number.isFinite(Number(entry.octopus || entry.fare))
            ? Number(entry.octopus || entry.fare)
            : null;
        flat = f;
      } catch (e) {
        flat = null;
      }
    }
    // Cache the result — prefer the per-stop map (upstream), otherwise the
    // flat number (JSON fallback). `null` means "no data, do not retry".
    const out = map || flat;
    _fareFlatCache.set(cacheKey, out);
    return out;
  };

  // ---- Per-route fare fetchers (extending fetchKmbRouteFare) ----
  // All fare helpers return `Map<seq, fare>` or `null`. The flat-fare ones
  // (CTB, GMB, LRT) hand back a Map where every seq maps to the same
  // single-route fare, so the per-stop fare pill is consistent across
  // the whole route.
  //
  // Order of preference when fetching a route's fare:
  //   1) The operator's own JSON fare endpoint (per-stop or section).
  //   2) Hardcoded fallback JSON in /assets/*.json (curated subset of
  //      well-known routes with published fares).
  //   3) `null` — the UI hides the per-stop pill rather than ship an
  //      empty placeholder.
  const _fareFlatCache = new Map(); // route/coKey → number | null
  // CTB + NWFB flat fare: try upstream `/route-fare` (404 / 422 in current
  // upstream state) then fall back to assets/ctb-fares.json. Always
  // returns a flat Map<seq, fare> for the route, never per-stop.
  const fetchCitybusRouteFare = async (route, dir) => {
    const cacheKey = `CTB/${route}`;
    if (_fareFlatCache.has(cacheKey)) return _fareFlatCache.get(cacheKey);
    let entry = null;
    try {
      const resp = await busetaUtils.fetchJSON(
        `${API.CITYBUS}/route-fare/ctb/${encodeURIComponent(route)}/${dir === 'I' ? 'inbound' : 'outbound'}/1`
      );
      if (resp && Array.isArray(resp.data) && resp.data.length > 0) {
        entry = resp.data[0];
      }
    } catch (e) {
      entry = null;
    }
    if (!entry) {
      try {
        const all = await busetaUtils.fetchJSON(`assets/ctb-fares.json`);
        entry = (all && all[route]) || null;
      } catch (e) {
        entry = null;
      }
    }
    const flat =
      entry && Number.isFinite(Number(entry.octopus || entry.fare))
        ? Number(entry.octopus || entry.fare)
        : null;
    _fareFlatCache.set(cacheKey, flat);
    return flat;
  };
  // GMB flat fare: upstream does not expose a per-stop fare endpoint, so
  // we always go through the hardcoded assets/gmb-fares.json keyed by
  // `${region}/${code}`. The routeMeta on each GMB route already carries
  // `_region` + `_code` so we use those instead of the route string.
  const fetchGmbRouteFare = async (region, code, route) => {
    const cacheKey = `GMB/${region}/${code}`;
    if (_fareFlatCache.has(cacheKey)) return _fareFlatCache.get(cacheKey);
    let entry = null;
    try {
      const all = await busetaUtils.fetchJSON(`assets/gmb-fares.json`);
      const key1 = `${region}/${code}`;
      const key2 = route ? `${region}/${route}` : null;
      entry = (all && (all[key1] || (key2 && all[key2]))) || null;
    } catch (e) {
      entry = null;
    }
    const flat =
      entry && Number.isFinite(Number(entry.octopus || entry.fare))
        ? Number(entry.octopus || entry.fare)
        : null;
    _fareFlatCache.set(cacheKey, flat);
    return flat;
  };
  // LRT flat fare: assets/lrt-fares.json is the only public source.
  const fetchLrtRouteFare = async (route) => {
    const cacheKey = `LRT/${route}`;
    if (_fareFlatCache.has(cacheKey)) return _fareFlatCache.get(cacheKey);
    let entry = null;
    try {
      const all = await busetaUtils.fetchJSON(`assets/lrt-fares.json`);
      entry = (all && all[route]) || null;
    } catch (e) {
      entry = null;
    }
    const flat =
      entry && Number.isFinite(Number(entry.octopus || entry.fare))
        ? Number(entry.octopus || entry.fare)
        : null;
    _fareFlatCache.set(cacheKey, flat);
    return flat;
  };
  // Expand a per-route fare into a Map<seq, fare> for the per-stop render
  // loop. `fare` can be:
  //   - a Map<seq, fare>   → returned as-is (KMB/LWB per-stop)
  //   - a single number    → spread across every seq of `stops`
  //   - null               → null (the UI skips the pill)
  const expandFareForStops = (fare, stops) => {
    if (fare == null) return null;
    if (fare instanceof Map) return fare;
    const m = new Map();
    const n = Number(fare);
    if (!Number.isFinite(n)) return null;
    stops.forEach((s) => {
      const seq = s && Number.isFinite(s._seq) ? s._seq : null;
      if (seq != null) m.set(seq, n);
    });
    return m.size > 0 ? m : null;
  };
  // Compute min/max fare from a Map<seq, fare> (or flat number). Returns
  // `{ min, max }` in numeric HKD, or `null` when no fare data.
  const fareRange = (fare) => {
    if (fare == null) return null;
    if (typeof fare === 'number') return { min: fare, max: fare };
    if (!(fare instanceof Map) || fare.size === 0) return null;
    let min = Infinity,
      max = -Infinity;
    fare.forEach((v) => {
      const n = Number(v);
      if (Number.isFinite(n)) {
        if (n < min) min = n;
        if (n > max) max = n;
      }
    });
    if (min === Infinity || max === -Infinity) return null;
    return { min, max };
  };
  // Format a fare for the pill: keep one decimal place, no currency
  // symbol (justarrived-style — the `$` is added by the renderer so it
  // matches the Octopus price with a `$` prefix instead of `HK$`).
  const fmtFare = (n) => {
    if (!Number.isFinite(n)) return '';
    return n.toFixed(1);
  };

  // Citybus + NWFB (CTB uses 6-digit numeric stop IDs)
  const fetchCitybusRouteStop = (route, dir) =>
    busetaUtils.fetchJSON(
      `${API.CITYBUS}/route-stop/ctb/${encodeURIComponent(route)}/${dir === 'I' ? 'inbound' : 'outbound'}`
    );
  const fetchCitybusStopEta = (stopId, route) =>
    busetaUtils.fetchJSON(
      `${API.CITYBUS}/eta/ctb/${encodeURIComponent(stopId)}/${encodeURIComponent(route)}`
    );
  // CTB stop metadata (name includes "Stop, Location" for many stops).
  const fetchCitybusStop = (stopId) =>
    busetaUtils.fetchJSON(`${API.CITYBUS}/stop/${encodeURIComponent(stopId)}`);
  // Per-stop ETA feed (CTB uses 6-digit numeric stop IDs).
  const fetchCitybusBatchStopEta = (stopId) =>
    busetaUtils.fetchJSON(
      `https://rt.data.gov.hk/v1/transport/batch/stop-eta/CTB/${encodeURIComponent(stopId)}`
    );
  // Returns the right ETA fetcher for a stop_id + route + dir.
  function fetchEtaForStop(stopId, route, dir) {
    if (typeof stopId === 'string' && /^[0-9a-fA-F]{16}$/.test(stopId))
      return fetchKmbStopEta(stopId);
    if (typeof stopId === 'string' && /^[0-9]{6}$/.test(stopId))
      return fetchCitybusStopEta(stopId, route);
    // Generic KMB route-stop lookup works for any operator's KMB-format stop.
    return fetchKmbStopEta(stopId);
  }

  // GMB (Green Minibus / 專線小巴)
  const fetchGmbRoute = (region, code) =>
    busetaUtils.fetchJSON(
      `${API.GMB}/route/${encodeURIComponent(region)}/${encodeURIComponent(code)}`
    );
  const fetchGmbRouteStops = (routeId, routeSeq) =>
    busetaUtils.fetchJSON(
      `${API.GMB}/route-stop/${encodeURIComponent(String(routeId))}/${encodeURIComponent(String(routeSeq))}`
    );
  const fetchGmbStopEta = (routeId, routeSeq, stopSeq) =>
    busetaUtils.fetchJSON(
      `${API.GMB}/eta/route-stop/${encodeURIComponent(String(routeId))}/${encodeURIComponent(String(routeSeq))}/${encodeURIComponent(String(stopSeq))}`
    );
  const fetchGmbStopRoutes = (stopId) =>
    busetaUtils.fetchJSON(`${API.GMB}/stop-route/${encodeURIComponent(String(stopId))}`);
  const fetchGmbStopCoord = (stopId) =>
    busetaUtils.fetchJSON(`${API.GMB}/stop/${encodeURIComponent(String(stopId))}`);

  // MTR (heavy rail) — line/station codes are 3-letter strings.
  const fetchMtrSchedule = (line, station) =>
    busetaUtils.fetchJSON(
      `${API.MTR}/getSchedule.php?line=${encodeURIComponent(line)}&sta=${encodeURIComponent(station)}&lang=tc`
    );

  // Light Rail — station_id is 3-digit numeric string (e.g. "001").
  const fetchLrtSchedule = (stationId) =>
    busetaUtils.fetchJSON(
      `${API.MTR}/lrt/getSchedule?station_id=${encodeURIComponent(String(stationId))}`
    );

  // Bounded-concurrency fetcher: runs up to `limit` fetches in parallel.
  async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        try {
          results[i] = await fn(items[i], i);
        } catch (e) {
          results[i] = { __error: e };
        }
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
    return busetaUtils
      .fetchJSON(API.CONFIG)
      .then((cfg) => {
        if (cfg && typeof cfg.gmapsKey === 'string') {
          state.gmapsKey = cfg.gmapsKey.trim();
        }
      })
      .catch(() => {});
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
    path.setAttribute(
      'd',
      'M12 2c-4.418 0-8 3.537-8 7.9 0 5.7 7.1 11.6 7.4 11.85a1 1 0 0 0 1.2 0c.3-.25 7.4-6.15 7.4-11.85 0-4.363-3.582-7.9-8-7.9zm0 10.9a3 3 0 1 1 0-6 3 3 0 0 1 0 6z'
    );
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
      const out = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      stopCoordCache.set(key, out);
      return out;
    } catch {
      stopCoordCache.set(key, null);
      return null;
    }
  }

  // Render the route-level map. Embeds a Google Maps iframe using the
  // legacy `output=embed` directions URL (saddr→daddr) — Google Maps
  // renders a route line + pins at the origin and destination, which is
  // the most we can get without an API key. Pipe-separated multi-pin
  // `q=lat,lng|...` URLs are silently ignored by the embed endpoint
  // (returns an empty `initEmbed` array), so we don't use that form.
  // Takes the resolved stop list and a `coordByStop` Map<stopId, {lat,lng}>;
  // returns a section Node, or null if fewer than two stops have coords.
  //
  // ---- v31 iframe-only revert ----
  // v29 tried to drop the iframe in favour of the SVG schematic; v30
  // tried a hybrid (iframe + nested SVG in one card). Both shipped but
  // the hybrid had a layout regression: when the iframe lazy-loaded at
  // its intrinsic size before CSS kicked in, the SVG container stretched
  // to fill the leftover space, blowing the route detail page past the
  // stop list. v31 keeps the iframe as the only map on the route detail
  // page and drops the live-bus schematic from this view. The vehicle-
  // positions helper and `renderVehicleMap()` are kept on disk for
  // future use (e.g. a future "live bus" toggle), but no longer rendered
  // on this page.

  // ------------------------------------------------------------------
  // Route map (v31 iframe-only) — single card with the Google Maps
  // directions iframe and an "Open in Maps" link below it. Stops for
  // the route are rendered as the `<stop-list>` heading + row loop
  // outside this card. No live-GPS schematic is rendered here.
  //
  // Architecture:
  //   - renderRouteMap() returns just the iframe + open-in-maps link
  //     wrapped in a `<section class="route-map">`. No innerSchematic.
  //   - renderVehicleMap() / placeholderVehiclePositions() /
  //     tryFetchLivePositions() / startVehicleRefresh() are all still
  //     defined below for future re-use, but no caller wires them up.
  //   - placeholderVehiclePositions() builds pseudo-positions from the
  //     ETA pattern when no live feed is available — buses are spread
  //     evenly along the polyline so the user sees something move-like
  //     instead of an empty box.
  //   - startVehicleRefresh() / stopVehicleRefresh() are paired with the
  //     existing eta refresh so the map's auto-refresh stops on view
  //     switch, matching the existing pattern (startEtaRefresh /
  //     stopEtaRefresh).
  // ------------------------------------------------------------------
  // v30 hybrid: outer route-map card (Google Maps iframe) with optional
  // nested SVG schematic for live bus positions. Returns a `<section>`,
  // or null if fewer than two stops have coords.
  function renderRouteMap(stops, coordByStop) {
    if (!stops || stops.length === 0) return null;
    const points = [];
    stops.forEach((s) => {
      const c = coordByStop.get(s.stop);
      if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
        points.push({ lat: c.lat, lng: c.lng });
      }
    });
    if (points.length < 2) return null;

    const origin = points[0];
    const destination = points[points.length - 1];

    const section = el('section', { class: 'route-map', 'aria-label': t_str('mapHeader') });
    const head = el(
      'div',
      { class: 'route-map-head' },
      el('span', { class: 'route-map-title' }, t_str('mapHeader')),
      el('span', { class: 'route-map-meta' }, `${points.length}/${stops.length}`)
    );
    section.appendChild(head);

    // saddr/daddr directions URL — Google Maps draws a route line between
    // the two endpoints and shows pins at both. No `z=` (let Maps pick so
    // both endpoints fit). No API key required; the user's saved key
    // upgrades the embed styling if present.
    const saddr = `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`;
    const daddr = `${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`;
    const params = new URLSearchParams({ saddr, daddr, output: 'embed' });
    const key = getGmapsKey();
    if (key) params.set('key', key);
    const iframe = el('iframe', {
      title: `${t_str('mapHeader')} · ${points.length}`,
      loading: 'lazy',
      referrerpolicy: 'no-referrer-when-downgrade',
      src: `https://maps.google.com/maps?${params.toString()}`,
      style: 'border:0;',
    });
    const frame = el('div', { class: 'route-map-frame' });
    frame.appendChild(iframe);
    section.appendChild(frame);

    // "Open in Google Maps" link so users can pan/zoom the full map in a
    // new tab. Centred on the route's midpoint.
    const link = el('a', {
      class: 'stop-map-link',
      href: `https://www.google.com/maps?saddr=${saddr}&daddr=${daddr}`,
      target: '_blank',
      rel: 'noopener',
    });
    link.appendChild(mapPinIconSVG());
    link.appendChild(el('span', {}, t_str('openInMaps')));
    section.appendChild(link);

    // Nest the SVG schematic as a sub-section inside the same card.
    // The schematic is built by renderVehicleMap() with a
    // `.vehicle-map-inline` wrapper (no outer chrome — the card above
    // already has the section title and frame).
    return section;
  }

  // Operator → colour used for the bus icon + polyline stroke. Falls back
  // to the route's accent when we don't recognise the operator. Kept in
  // sync with the operator-strip chip colours used elsewhere.
  const VEHICLE_OP_COLOR = {
    KMB: '#E11D48', // crimson (KMB brand red)
    LWB: '#B45309', // amber (LWB brand gold-ish)
    CTB: '#0284C2', // CTB blue
    NWFB: '#0EA5E9', // NWFB sky-blue
    GMB: '#16A34A', // green for minibus
    MTR: '#7C3AED', // MTR purple
    LRT: '#F59E0B', // LRT yellow-orange
  };

  // Promise-cached lazy-load of the vehicle-positions helper. Mirrors
  // __buseta.loadPlannerScript in spirit: a single <script> tag, cached
  // at module level so subsequent vehicle-map renders don't refetch.
  let _vehicleHelperLoad = null;
  function loadVehicleHelper() {
    if (window.BusEtaVehicles && typeof window.BusEtaVehicles.fetchPositions === 'function') {
      return Promise.resolve(window.BusEtaVehicles);
    }
    if (_vehicleHelperLoad) return _vehicleHelperLoad;
    _vehicleHelperLoad = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'assets/vehicle-positions.js';
      s.async = false; // preserve execution order with the next dependent call
      s.onload = () => {
        if (window.BusEtaVehicles) resolve(window.BusEtaVehicles);
        else reject(new Error('vehicle-positions.js did not register BusEtaVehicles'));
      };
      s.onerror = () => reject(new Error('vehicle-positions.js failed to load'));
      document.head.appendChild(s);
    }).catch((e) => {
      // Reset on failure so a later retry has a chance.
      _vehicleHelperLoad = null;
      throw e;
    });
    return _vehicleHelperLoad;
  }

  // Build placeholder pseudo-positions when no live GPS feed is
  // available. We use the upcoming-ETA `diff` value (minutes from now)
  // to interpolate each bus somewhere along the polyline: a bus with
  // `diff` ≤ 2 sits near the destination, `diff` ≥ 15 sits near the
  // origin. With no ETAs at all, fall back to N evenly-distributed
  // positions (3 buses by default — matches a typical KMB frequency).
  //
  // Returns `{ positions: [{co, lat, lng, id}], placeholder: true }`.
  // `placeholder: true` lets the header flag the section as "estimated"
  // so the user knows the icons aren't real.
  function placeholderVehiclePositions(stops, coordByStop, etasByStop, op) {
    const routePoints = [];
    stops.forEach((s) => {
      const c = coordByStop.get(s.stop);
      if (c) routePoints.push(c);
    });
    if (routePoints.length < 2) return { positions: [], placeholder: true };

    // Find the longest available ETA tail (the leading arrival per stop)
    // and use it as a progress signal.
    const etas = [];
    if (etasByStop && etasByStop.size) {
      for (const s of stops) {
        const arr = etasByStop.get(s.stop);
        if (arr && arr.length) {
          let m = null;
          if (typeof arr[0].diff !== 'undefined') m = parseInt(arr[0].diff, 10);
          else if (arr[0].eta) m = minutesUntil(arr[0].eta);
          if (Number.isFinite(m)) etas.push(m);
        }
      }
    }

    // Map "minutes away" → fractional position along polyline [0..1].
    // Heuristic: 1 min ≈ 95% to destination, 15 min ≈ 5% (near origin),
    // clamped so the bus never goes past either endpoint.
    const etaToFrac = (m) => {
      if (!Number.isFinite(m)) return 0.5;
      // Asymptotic mapping: 0 min → 1.0, ∞ min → 0.0.
      const f = 1 / (1 + m * 0.5);
      return Math.max(0, Math.min(1, f));
    };

    const positions = [];
    if (etas.length > 0) {
      etas.forEach((m, i) => {
        const f = etaToFrac(m);
        positions.push({ co: op || 'KMB', lat: 0, lng: 0, id: `eta-${i}`, _frac: f });
      });
    } else {
      // No ETAs → 3 evenly-spaced placeholder buses.
      [0.2, 0.5, 0.8].forEach((f, i) => {
        positions.push({ co: op || 'KMB', lat: 0, lng: 0, id: `ph-${i}`, _frac: f });
      });
    }

    // Project each placeholder's fractional progress to a real lat/lng
    // by interpolating along the polyline.
    positions.forEach((p) => {
      const f = Number.isFinite(p._frac) ? p._frac : 0.5;
      const idx = f * (routePoints.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.min(routePoints.length - 1, lo + 1);
      const t = idx - lo;
      const a = routePoints[lo];
      const b = routePoints[hi];
      p.lat = a.lat + (b.lat - a.lat) * t;
      p.lng = a.lng + (b.lng - a.lng) * t;
      delete p._frac;
    });

    return { positions, placeholder: true };
  }

  // Project a single lat/lng into the SVG viewBox using a simple
  // equirectangular projection scaled to the route's bounding box.
  // `bounds` is `{minLat, maxLat, minLng, maxLng}` (degrees).
  // `view` is `{width, height, padX, padY}` in user units.
  function projectLatLng(lat, lng, bounds, view) {
    const { minLat, maxLat, minLng, maxLng } = bounds;
    const spanLat = Math.max(1e-6, maxLat - minLat);
    const spanLng = Math.max(1e-6, maxLng - minLng);
    // Equirectangular: x ∝ lng, y ∝ -lat (SVG y is downward).
    const fx = (lng - minLng) / spanLng;
    const fy = (lat - minLat) / spanLat;
    return {
      x: view.padX + fx * (view.width - 2 * view.padX),
      y: view.padY + (1 - fy) * (view.height - 2 * view.padY),
    };
  }

  // Pure-SVG vehicle map. Returns a <section> Node with a route polyline,
  // stop dots, and bus icons (color-coded by operator). When `positions`
  // is null / empty, falls back to placeholder pseudo-positions and
  // marks the section header accordingly. Returns `null` when fewer than
  // two stops have usable coordinates (so the caller can safely drop the
  // node from the page rather than rendering an empty box).
  function renderVehicleMap(stops, coordByStop, positions, opts) {
    const o = opts || {};
    const isPlaceholder = !positions || !positions.length;
    const op = o.op || (stops && stops[0] && stops[0].co) || 'KMB';
    const color = VEHICLE_OP_COLOR[op] || 'var(--accent)';

    // Collect the route polyline coordinates (must have ≥ 2 points).
    const routePts = [];
    stops.forEach((s) => {
      const c = coordByStop.get(s.stop);
      if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
        routePts.push({ lat: c.lat, lng: c.lng });
      }
    });
    if (routePts.length < 2) return null;

    // Also include live bus positions (if any) when computing the bounding
    // box, so an off-route bus doesn't get clipped at the edge.
    const allPts = routePts.slice();
    if (!isPlaceholder) {
      positions.forEach((p) => {
        if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
          allPts.push({ lat: p.lat, lng: p.lng });
        }
      });
    }
    let minLat = allPts[0].lat,
      maxLat = allPts[0].lat;
    let minLng = allPts[0].lng,
      maxLng = allPts[0].lng;
    for (const p of allPts) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
    // Pad the bbox so dots/buses don't sit on the frame edge.
    const padLat = (maxLat - minLat) * 0.12 || 0.005;
    const padLng = (maxLng - minLng) * 0.12 || 0.005;
    minLat -= padLat;
    maxLat += padLat;
    minLng -= padLng;
    maxLng += padLng;
    const bounds = { minLat, maxLat, minLng, maxLng };
    // Slightly taller than the pre-merge vehicle-map (was 200) since this
    // is now the only map on the route detail page.
    const view = { width: 320, height: 220, padX: 18, padY: 18 };

    // Build the <svg> root.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${view.width} ${view.height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('class', 'vehicle-map-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t_str('vehicleMap'));

    // ---- route polyline ----
    const polyPts = routePts.map((p) => projectLatLng(p.lat, p.lng, bounds, view));
    const linePath = polyPts
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
      .join(' ');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', linePath);
    path.setAttribute('class', 'vehicle-route-line');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);

    // ---- stop dots ----
    stops.forEach((s, idx) => {
      const c = coordByStop.get(s.stop);
      if (!c) return;
      const pt = projectLatLng(c.lat, c.lng, bounds, view);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', pt.x.toFixed(2));
      dot.setAttribute('cy', pt.y.toFixed(2));
      dot.setAttribute('r', idx === 0 ? '5' : '3.5');
      dot.setAttribute('class', 'vehicle-stop-dot' + (idx === 0 ? ' is-origin' : ''));
      dot.setAttribute('fill', 'var(--card)');
      dot.setAttribute('stroke', color);
      dot.setAttribute('stroke-width', '2');
      svg.appendChild(dot);
    });

    // ---- bus icons ----
    const buses = isPlaceholder
      ? placeholderVehiclePositions(stops, coordByStop, o.etasByStop, op).positions
      : positions;
    buses.forEach((b, i) => {
      if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return;
      const pt = projectLatLng(b.lat, b.lng, bounds, view);
      // Tiny circle (the bus body) + a small "bus" glyph dot on top.
      const body = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      body.setAttribute('cx', pt.x.toFixed(2));
      body.setAttribute('cy', pt.y.toFixed(2));
      body.setAttribute('r', '7');
      body.setAttribute('class', 'vehicle-icon' + (isPlaceholder ? ' is-placeholder' : ''));
      body.setAttribute('fill', color);
      body.setAttribute('stroke', 'var(--card)');
      body.setAttribute('stroke-width', '2');
      // Brief inline title so hovering reveals the operator + status.
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = isPlaceholder
        ? `${t_str('vehiclePlaceholder')} · ${op}`
        : `${t_str('vehiclePosition')} · ${op}`;
      body.appendChild(title);
      svg.appendChild(body);
      // White "bus" stripe across the middle so the icon reads as a bus.
      const stripe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const sx = pt.x - 4.5;
      const sy = pt.y - 1.5;
      stripe.setAttribute('x', sx.toFixed(2));
      stripe.setAttribute('y', sy.toFixed(2));
      stripe.setAttribute('width', '9');
      stripe.setAttribute('height', '3');
      stripe.setAttribute('rx', '0.8');
      stripe.setAttribute('fill', 'var(--card)');
      svg.appendChild(stripe);
    });

    // ---- sub-section wrapper (v30 hybrid) ----
    // The route-map card above owns the section title and frame chrome,
    // so this wrapper is just a thin inline container — no section
    // borders, no card padding. The title says "實時車輛位置" (not
    // "地圖") to make it clear it's a sub-section, and the Open-in-
    // Maps link is dropped because the iframe above is the Google
    // Maps view.
    const wrapper = el('div', {
      class: 'vehicle-map-inline' + (isPlaceholder ? ' is-placeholder' : ' is-live'),
      'aria-label': t_str('vehicleMap'),
    });
    const head = el('div', { class: 'vehicle-map-inline-head' });
    head.appendChild(el('span', { class: 'vehicle-map-inline-title' }, t_str('vehicleMap')));
    const badge = el(
      'span',
      {
        class: 'vehicle-map-badge' + (isPlaceholder ? ' is-placeholder' : ' is-live'),
      },
      isPlaceholder ? t_str('vehiclePlaceholder') : t_str('vehicleLive')
    );
    head.appendChild(badge);
    wrapper.appendChild(head);
    const frame = el('div', { class: 'vehicle-map-frame' });
    frame.appendChild(svg);
    wrapper.appendChild(frame);
    if (isPlaceholder) {
      const hint = el('p', { class: 'vehicle-map-hint' }, t_str('vehicleNoData'));
      wrapper.appendChild(hint);
    }
    return wrapper;
  }

  // Try to get live positions for the current route. Returns a Promise
  // that resolves to either an array of `{co, lat, lng, ...}` objects
  // (when the upstream exposes GPS) or `null` (when it doesn't — the
  // caller should fall back to placeholder mode). Never throws; failures
  // degrade silently into `null`.
  async function tryFetchLivePositions(co, route, dir, service, signal) {
    if (!window.BusEtaVehicles) {
      try {
        await loadVehicleHelper();
      } catch (e) {
        return null;
      }
    }
    if (!window.BusEtaVehicles || typeof window.BusEtaVehicles.fetchPositions !== 'function') {
      return null;
    }
    try {
      const result = await window.BusEtaVehicles.fetchPositions(co, route, dir, service, {
        signal,
      });
      return Array.isArray(result) && result.length > 0 ? result : null;
    } catch (e) {
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Vehicle-map auto-refresh
  //
  // We refresh every 30s (faster than the ETA refresh's 60s) so a real
  // GPS icon, when one becomes available, surfaces quickly. The map
  // holds its own timer (state.vehicleTimer) so it can be paused
  // independently when the user navigates away from the route view.
  // ------------------------------------------------------------------
  const VEHICLE_REFRESH_MS = 30_000;

  function startVehicleRefresh(refreshFn) {
    stopVehicleRefresh();
    state.vehicleTimer = setInterval(() => {
      try {
        refreshFn();
      } catch (e) {
        /* swallow — visual refresh only */
      }
    }, VEHICLE_REFRESH_MS);
  }

  function stopVehicleRefresh() {
    if (state.vehicleTimer) {
      clearInterval(state.vehicleTimer);
      state.vehicleTimer = null;
    }
    if (state.vehicleAbort) {
      try {
        state.vehicleAbort.abort();
      } catch (e) {
        /* noop */
      }
      state.vehicleAbort = null;
    }
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
    } catch {
      return null;
    }
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
        const resp = await busetaUtils.fetchJSON(`${API.GMB}/route`);
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
    const cache = (state.gmbEnrichCache = state.gmbEnrichCache || new Set());
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
          const arr = resp && Array.isArray(resp.data) ? resp.data : [];
          for (const r of arr) {
            const dircode = r.directions && r.directions.length ? r.directions[0].route_seq : 1;
            const key = makeRouteKey(
              'GMB',
              `${item.region}-${item.code}`,
              String(dircode),
              String(r.route_id)
            );
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
      const out = state.index.stops.get(stopId) || {
        stop: stopId,
        nameTc: '',
        nameSc: '',
        nameEn: '',
      };
      out.lat = lat;
      out.lng = lng;
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
  //
  // GeolocationPositionError codes (spec):
  //   1 = PERMISSION_DENIED
  //   2 = POSITION_UNAVAILABLE
  //   3 = TIMEOUT
  // We treat 1 as "denied" (user explicitly said no) and 2/3 (and anything
  // else) as "unavailable" (silent failure). The original code referenced
  // `err.PERMISSION_DENIED` — that's a static on the constructor, not an
  // instance property, so the check was always false and every error was
  // bucketed as 'unavailable'. Fixed by comparing the numeric code.
  const GEO_ERR_PERMISSION_DENIED = 1;
  // Guard against stacking multiple getCurrentPosition calls while a
  // previous request is still in flight. Reset on terminal transitions
  // (ok / denied / unavailable) inside the callbacks, plus a watchdog
  // in case the browser's callback never fires (silent WebView reject).
  let geoInFlight = false;
  let geoWatchdog = null;
  // Cache the latest known permission state from the Permissions API so we
  // can proactively detect "browser has cached a Block decision" without
  // having to wait for getCurrentPosition to fire its (silent) error
  // callback. Browsers never re-show the permission prompt after a Block
  // decision until they reset the site's permission manually.
  let geoPermissionState = 'prompt'; // 'granted' | 'denied' | 'prompt'
  async function probeGeoPermission() {
    if (!navigator.permissions || !navigator.permissions.query) return 'prompt';
    try {
      const r = await navigator.permissions.query({ name: 'geolocation' });
      geoPermissionState = r.state;
      // Track future changes (e.g. user resets in site settings).
      if (r.addEventListener) {
        r.addEventListener('change', () => {
          geoPermissionState = r.state;
          logGeoStatus(`permission changed: ${r.state}`);
        });
      }
      logGeoStatus(`permission probed: ${r.state}`);
      return r.state;
    } catch {
      return 'prompt';
    }
  }
  function requestLocation() {
    // Always allow re-prompt: a stuck 'pending' can happen if the previous
    // getCurrentPosition callback never fired (silent WebView reject).
    // retryLocation() resets state so the user can opt back in cleanly.
    // We only short-circuit when there's already an in-flight request to
    // avoid stacking native dialogs on rapid double-clicks.
    if (geoInFlight) return;
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      toast(t_str('locationUnavailable'));
      return;
    }
    // Proactively detect "blocked at browser level" — once a site is
    // blocked, the browser will never show the prompt again. Call the
    // user out on it instead of silently falling through to a denied
    // error path that looks like the app is broken.
    if (geoPermissionState === 'denied') {
      setLocationStatus('denied');
      toast(t_str('locationBlockedHint'));
      rerenderLocationViews();
      return;
    }
    geoInFlight = true;
    setLocationStatus('pending');
    rerenderLocationViews();
    // Safety net: if neither success nor error fires within the timeout,
    // assume a stuck prompt and surface an error state so the user isn't
    // stranded on the spinner forever.
    clearTimeout(geoWatchdog);
    geoWatchdog = setTimeout(() => {
      if (!geoInFlight) return;
      geoInFlight = false;
      logGeoStatus('watchdog: getCurrentPosition never resolved');
      setLocationStatus('unavailable');
      toast(t_str('locationUnavailable'));
      rerenderLocationViews();
    }, 10_000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(geoWatchdog);
        geoInFlight = false;
        state.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        state.userLoc = state.location;
        geoPermissionState = 'granted';
        setLocationStatus('ok');
        toast(t_str('locationGranted'));
        rerenderLocationViews();
      },
      (err) => {
        clearTimeout(geoWatchdog);
        geoInFlight = false;
        // Always update state on every error path — never leave it stuck
        // on 'pending' (which would block re-prompt via the old early-
        // return guard).
        const code = err && typeof err.code === 'number' ? err.code : null;
        const next = code === GEO_ERR_PERMISSION_DENIED ? 'denied' : 'unavailable';
        if (next === 'denied') geoPermissionState = 'denied';
        setLocationStatus(next);
        // Some embedded WebViews (incl. some in-app browsers) return
        // PERMISSION_DENIED even after the user clicks "Allow" in the
        // permission dialog because the underlying OS-level location
        // service is unavailable. Surface this with a clearer toast so
        // users know it's a browser/environment limitation, not their
        // own action.
        if (next === 'denied') {
          logGeoStatus(`browser refused (code=${code}, message=${err && err.message})`);
          toast(t_str('locationDenied'));
        } else {
          toast(t_str('locationUnavailable'));
        }
        rerenderLocationViews();
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 }
    );
    // Fire the permission probe asynchronously; if it discovers the
    // browser has cached a Block decision, we'll catch the user before
    // they stare at the spinner.
    probeGeoPermission().then((s) => {
      if (s === 'denied' && geoInFlight) {
        clearTimeout(geoWatchdog);
        geoInFlight = false;
        setLocationStatus('denied');
        toast(t_str('locationBlockedHint'));
        rerenderLocationViews();
      }
    });
  }

  // Reset state so the user can opt back in from a denied/unavailable
  // banner. Called by the "再試一次 / Try again" button on the banner.
  function retryLocation() {
    state._geoAsked = false;
    state.locationStatus = 'idle';
    state.userLoc = null;
    state.location = null;
    logGeoStatus('reset');
    rerenderLocationViews();
    requestLocation();
  }

  // Single mutation point for the geolocation status. Keeps the console
  // log discipline in one place so future debugging doesn't require
  // grepping every branch.
  function setLocationStatus(next) {
    const prev = state.locationStatus;
    state.locationStatus = next;
    if (next !== 'idle') state._geoAsked = true;
    logGeoStatus(`transition: ${prev} → ${next}`);
  }
  function logGeoStatus(msg) {
    try {
      // Phase 33 — delegates to busetaUtils.debugLog (src/utils/debug-log.js).
      // Production users see no output; the maintainer enables via
      // `window.busetaDebug = true; location.reload()` in DevTools.
      busetaUtils.debugLog('[geo]', msg, {
        status: state.locationStatus,
        asked: !!state._geoAsked,
        hasLoc: !!state.userLoc,
      });
    } catch {}
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
    if (h === '/settings') return { view: 'settings' };
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
  function currentRoute() {
    return parseHash().view;
  }

  function showView(name) {
    [
      'splash',
      'view-home',
      'view-search',
      'view-route',
      'view-stop',
      'view-error',
      'view-planner',
      'view-settings',
    ].forEach((id) => {
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
    $$('[data-i18n]', root).forEach((n) => {
      n.textContent = t_str(n.dataset.i18n);
    });
    $$('[data-i18n-attr]', root).forEach((n) => {
      try {
        const map = JSON.parse(n.dataset.i18nAttr);
        for (const [attr, key] of Object.entries(map)) n.setAttribute(attr, t_str(key));
      } catch {}
    });
    $$('[data-i18n-html]', root).forEach((n) => {
      n.innerHTML = t_str(n.dataset.i18nHtml);
    });
  }

  function onHashChange() {
    const r = parseHash();
    // Bottom nav active state
    let active = 'home';
    if (r.view === 'search') active = 'search';
    else if (r.view === 'planner') active = 'planner';
    else if (r.view === 'home') active = 'home';
    else if (r.view === 'route' || r.view === 'stop')
      active = null; // QW-9: no nav item lit on detail
    else if (r.view === 'settings') active = null; // QW-3: settings has its own header link
    // QW-9: only the home nav item carries the "you're inside a sub-page"
    // dot indicator when on /route/... or /stop/...
    const onDetail = r.view === 'route' || r.view === 'stop';
    $$('.nav-item').forEach((n) => {
      n.classList.toggle('is-active', n.dataset.route === active);
      n.classList.toggle('is-detail', onDetail && n.dataset.route === 'home');
      // a11y (Phase 17): mirror `is-active` into aria-current="page" so
      // screen readers announce "current page" on the active nav item
      // instead of just trusting the visual underline. We clear the
      // attribute on inactive items so it doesn't dangle on hashchange.
      const isActive = n.dataset.route === active;
      if (isActive) n.setAttribute('aria-current', 'page');
      else n.removeAttribute('aria-current');
    });

    // Hide splash once we navigate
    const splash = document.getElementById('splash');
    if (splash && !splash.hidden) splash.hidden = true;

    switch (r.view) {
      case 'home':
        renderHome();
        break;
      case 'search':
        renderSearch();
        break;
      case 'planner':
        renderPlannerView();
        break;
      case 'settings':
        renderSettings();
        break;
      case 'route':
        renderRoute(r);
        break;
      case 'stop':
        renderStop(r);
        break;
      default:
        renderError();
    }
    window.scrollTo(0, 0);
    // a11y: shift focus to the <main> region so screen readers announce
    // the new view's heading after navigation. `<main>` has
    // `tabindex="-1"` (index.html) so it can receive programmatic focus
    // without entering the tab order. `preventScroll: true` keeps the
    // explicit `scrollTo(0, 0)` above authoritative — focus() would
    // otherwise scroll the focused element into view, which we don't
    // want here. Phase 13 a11y fix.
    const main = document.getElementById('main');
    if (main) main.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------
  // Home
  // ------------------------------------------------------------------

  // First-run / empty-state hero. Shown only when the user has no saved
  // routes, no saved stops and no recent activity. The 3 CTAs cover the
  // three "ways in" the app exposes on first visit: textual search,
  // location-driven nearby stops, and browsing popular routes. Once any
  // of savedRoutes / savedStops / recent gains an entry this helper is
  // not called and the standard populated renderHome path runs.
  //
  // CSS lives in `.home-empty*` selectors at the bottom of style.css and
  // uses only theme variables — safe for `data-theme="light"` switching.
  function buildHomeEmptyState() {
    const wrap = el('section', {
      class: 'home-empty',
      role: 'region',
      'aria-label': t_str('homeEmptyTitle'),
    });

    // Pure-CSS illustration: a stylised bus + two arrows hinting "go
    // discover routes". No raster, no SVG markup — just nested divs
    // styled with `.home-empty-illustration*` rules.
    const illo = el('div', { class: 'home-empty-illustration', 'aria-hidden': 'true' });
    const bus = el('div', { class: 'home-empty-bus' });
    const busBody = el('div', { class: 'home-empty-bus-body' });
    const busWin1 = el('div', { class: 'home-empty-bus-win' });
    const busWin2 = el('div', { class: 'home-empty-bus-win' });
    const busDoor = el('div', { class: 'home-empty-bus-door' });
    const busWheelL = el('div', { class: 'home-empty-bus-wheel' });
    const busWheelR = el('div', { class: 'home-empty-bus-wheel' });
    const busLight = el('div', { class: 'home-empty-bus-light' });
    bus.appendChild(busBody);
    busBody.appendChild(busWin1);
    busBody.appendChild(busWin2);
    busBody.appendChild(busDoor);
    busBody.appendChild(busLight);
    bus.appendChild(busWheelL);
    bus.appendChild(busWheelR);
    illo.appendChild(bus);
    illo.appendChild(el('div', { class: 'home-empty-arrow home-empty-arrow--a' }));
    illo.appendChild(el('div', { class: 'home-empty-arrow home-empty-arrow--b' }));
    illo.appendChild(el('div', { class: 'home-empty-arrow home-empty-arrow--c' }));
    wrap.appendChild(illo);

    // Hero title — i18n-driven.
    wrap.appendChild(el('h2', { class: 'home-empty-title', 'data-i18n': 'homeEmptyTitle' }));

    // Three CTAs in a clear vertical stack. The "locate" CTA's label and
    // handler change based on whether the user has already granted
    // location: idle → requestLocation(); granted → retryLocation() so
    // they can refresh the fix. All three navigate with the standard
    // hash scheme — no full-page reload.
    const ctas = el('div', { class: 'home-empty-ctas' });

    const hasLoc = !!state.userLoc;
    const locateLabel = hasLoc ? 'homeEmptyLocateUpdate' : 'homeEmptyLocate';
    const locateHandler = hasLoc
      ? () => {
          retryLocation();
        }
      : () => {
          requestLocation();
        };

    const ctaSearch = el('a', {
      class: 'home-empty-cta home-empty-cta--primary',
      href: '#/search',
    });
    ctaSearch.appendChild(el('span', { class: 'home-empty-cta-icon', 'aria-hidden': 'true' }));
    const ctaSearchIcon = ctaSearch.firstChild;
    const searchSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    searchSvg.setAttribute('viewBox', '0 0 24 24');
    searchSvg.setAttribute('width', '18');
    searchSvg.setAttribute('height', '18');
    searchSvg.setAttribute('aria-hidden', 'true');
    const sCirc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    sCirc.setAttribute('cx', '11');
    sCirc.setAttribute('cy', '11');
    sCirc.setAttribute('r', '7');
    sCirc.setAttribute('fill', 'none');
    sCirc.setAttribute('stroke', 'currentColor');
    sCirc.setAttribute('stroke-width', '1.8');
    const sLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    sLine.setAttribute('d', 'M20 20l-3.5-3.5');
    sLine.setAttribute('fill', 'none');
    sLine.setAttribute('stroke', 'currentColor');
    sLine.setAttribute('stroke-width', '1.8');
    sLine.setAttribute('stroke-linecap', 'round');
    searchSvg.appendChild(sCirc);
    searchSvg.appendChild(sLine);
    ctaSearchIcon.appendChild(searchSvg);
    ctaSearch.appendChild(el('span', { 'data-i18n': 'homeEmptySearch' }));
    ctas.appendChild(ctaSearch);

    const ctaLocate = el('button', {
      class: 'home-empty-cta home-empty-cta--secondary',
      type: 'button',
      onclick: locateHandler,
    });
    const ctaLocateIcon = el('span', { class: 'home-empty-cta-icon', 'aria-hidden': 'true' });
    const pinSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pinSvg.setAttribute('viewBox', '0 0 24 24');
    pinSvg.setAttribute('width', '18');
    pinSvg.setAttribute('height', '18');
    pinSvg.setAttribute('aria-hidden', 'true');
    const pinPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pinPath.setAttribute('fill', 'currentColor');
    pinPath.setAttribute(
      'd',
      'M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z'
    );
    pinSvg.appendChild(pinPath);
    ctaLocateIcon.appendChild(pinSvg);
    ctaLocate.appendChild(ctaLocateIcon);
    ctaLocate.appendChild(el('span', { 'data-i18n': locateLabel }));
    ctas.appendChild(ctaLocate);

    const ctaHot = el('a', {
      class: 'home-empty-cta home-empty-cta--secondary',
      href: '#/search',
    });
    const ctaHotIcon = el('span', { class: 'home-empty-cta-icon', 'aria-hidden': 'true' });
    const hotSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    hotSvg.setAttribute('viewBox', '0 0 24 24');
    hotSvg.setAttribute('width', '18');
    hotSvg.setAttribute('height', '18');
    hotSvg.setAttribute('aria-hidden', 'true');
    const hotPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    // Flame / star — generic "popular" glyph
    hotPath.setAttribute('fill', 'currentColor');
    hotPath.setAttribute(
      'd',
      'M12 2c.5 3 2.5 4 2.5 7a2.5 2.5 0 0 1-5 0c0-1 .5-1.5.5-2.5C8 7 6 9 6 12a6 6 0 1 0 12 0c0-4-3-6-6-10z'
    );
    hotSvg.appendChild(hotPath);
    ctaHotIcon.appendChild(hotSvg);
    ctaHot.appendChild(ctaHotIcon);
    ctaHot.appendChild(el('span', { 'data-i18n': 'homeEmptyHot' }));
    ctas.appendChild(ctaHot);

    wrap.appendChild(ctas);

    // Footer tip — the "long-press to save" hint mirrors how saved routes
    // are added elsewhere in the app (routeRow long-press handler).
    const tip = el('p', { class: 'home-empty-tip' });
    tip.appendChild(el('span', { class: 'home-empty-tip-tag' }, 'Tip'));
    tip.appendChild(document.createTextNode(' '));
    tip.appendChild(el('span', { 'data-i18n': 'homeEmptyTip' }));
    wrap.appendChild(tip);

    return wrap;
  }

  // First-run onboarding tip card. Renders a dismissable 3-step primer
  // at the top of the home view so a brand-new user can see — at a
  // glance — what the app can do and how to start. The dismiss button
  // persists `buseta.onboarded = "1"` in localStorage so returning users
  // never see the card again. Pure structural component: all visible
  // strings live in the STRINGS table and run through the i18n pipeline
  // via `data-i18n` on every `applyI18n()` pass.
  function buildOnboardCard() {
    const card = el('section', {
      class: 'onboard-card',
      role: 'region',
      'aria-label': t_str('onboardTitle'),
    });

    // Inline close (×) button. Top-right of the card. Closing is the
    // same action as tapping "知道了" — both write to localStorage and
    // remove the card. We give the user two affordances because the
    // dismiss button is at the bottom and the × is more discoverable.
    const closeBtn = el('button', {
      type: 'button',
      class: 'onboard-card__close',
      'aria-label': t_str('onboardDismiss'),
    });
    closeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
      '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/>' +
      '</svg>';
    closeBtn.addEventListener('click', () => dismissOnboardCard(card));
    card.appendChild(closeBtn);

    card.appendChild(el('h2', { class: 'onboard-card__title', 'data-i18n': 'onboardTitle' }));
    card.appendChild(el('p', { class: 'onboard-card__lead', 'data-i18n': 'onboardLead' }));

    // Each row pairs a tinted icon with title + body text. The icon
    // background uses --accent-soft so it picks up the same accent that
    // lights up the brand chips / CTAs elsewhere.
    const rows = [
      { titleKey: 'onboardPlannerTitle', bodyKey: 'onboardPlannerBody', svg: 'planner' },
      { titleKey: 'onboardSearchTitle', bodyKey: 'onboardSearchBody', svg: 'search' },
      { titleKey: 'onboardNearbyTitle', bodyKey: 'onboardNearbyBody', svg: 'pin' },
    ];
    const list = el('ul', { class: 'onboard-card__list' });
    rows.forEach((row) => {
      const li = el('li', { class: 'onboard-card__row' });
      const iconWrap = el('span', { class: 'onboard-card__icon', 'aria-hidden': 'true' });
      iconWrap.appendChild(onboardIcon(row.svg));
      li.appendChild(iconWrap);

      const txt = el('div', { class: 'onboard-card__row-text' });
      txt.appendChild(el('div', { class: 'onboard-card__row-title', 'data-i18n': row.titleKey }));
      txt.appendChild(el('div', { class: 'onboard-card__row-body', 'data-i18n': row.bodyKey }));
      li.appendChild(txt);
      list.appendChild(li);
    });
    card.appendChild(list);

    const dismissBtn = el('button', {
      type: 'button',
      class: 'onboard-card__dismiss',
      'data-i18n': 'onboardDismiss',
    });
    dismissBtn.addEventListener('click', () => dismissOnboardCard(card));
    card.appendChild(dismissBtn);

    return card;
  }

  // Build one of the three small SVG glyphs inside an .onboard-card__icon
  // tile. Kept inline (no separate file, no sprite) so the card works
  // even when the rest of the app is still preloading.
  function onboardIcon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.8');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    if (name === 'planner') {
      // Two arrows swapping — matches the bottom-nav "行程" glyph.
      p.setAttribute('d', 'M6 7h12M6 7l3-3M6 7l3 3M18 17H6M18 17l-3 3M18 17l-3-3');
    } else if (name === 'search') {
      // Magnifier — matches the bottom-nav "搜尋" glyph.
      p.setAttribute('d', 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5');
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', '11');
      c.setAttribute('cy', '11');
      c.setAttribute('r', '7');
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke', 'currentColor');
      c.setAttribute('stroke-width', '1.8');
      svg.appendChild(c);
    } else {
      // Pin — matches the in-app "啟用定位" CTA glyph.
      p.setAttribute('d', 'M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z');
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', '12');
      c.setAttribute('cy', '10');
      c.setAttribute('r', '2.5');
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke', 'currentColor');
      c.setAttribute('stroke-width', '1.8');
      svg.appendChild(c);
    }
    svg.appendChild(p);
    return svg;
  }

  // Dismiss handler shared between the inline × and the bottom "知道了"
  // button. Persists `buseta.onboarded = "1"` so the next home render
  // skips the card entirely. We deliberately do NOT delete the key on a
  // "reset" path — once onboarded, always onboarded; the card has done
  // its job and shouldn't pop up again even after cache clears because
  // any localStorage reset also wipes saved routes / recent, which is a
  // strong enough "fresh device" signal that re-prompting is appropriate.
  function dismissOnboardCard(card) {
    try {
      storage.set(STORAGE_KEYS.ONBOARDED, 1);
    } catch {
      /* private mode */
    }
    if (card && card.parentNode) card.parentNode.removeChild(card);
  }

  // True if the user has already seen + dismissed the onboarding card.
  // We only flip the flag on an explicit dismiss (× or button), so a
  // brand-new install always sees the card on the first home render.
  function hasOnboarded() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.ONBOARDED)) === 1;
    } catch {
      return false;
    }
  }

  // Empty-state block for the per-section home cards (未有收藏路線 /
  // 未有收藏車站 / 最近查過). Renders the same dashed `.empty` surface
  // the user used to see, plus a single line of "how do I add stuff"
  // advice and an inline CTA that jumps to the relevant flow. The CTA
  // is a real `<a href="#/...">` so it benefits from native focus,
  // long-press menu, and bottom-nav history — not a fake button.
  //
  //   textKey — the "no items yet" copy (emptyRoutes / emptyStops / emptyRecent)
  //   tipKey  — the contextual "how to populate" hint
  //   ctaKey  — CTA label
  //   ctaHref — destination hash route
  function buildEmptyStateBlock({ textKey, tipKey, ctaKey, ctaHref }) {
    const block = el('div', { class: 'empty-state-block' });
    block.appendChild(el('p', { class: 'empty-state-block__text', 'data-i18n': textKey }));
    if (tipKey) {
      block.appendChild(el('p', { class: 'empty-state-block__tip', 'data-i18n': tipKey }));
    }
    if (ctaKey && ctaHref) {
      const cta = el('a', {
        class: 'empty-state-block__cta',
        href: ctaHref,
      });
      cta.appendChild(el('span', { 'data-i18n': ctaKey }));
      // Trailing chevron — communicates "this takes you somewhere"
      // without leaning on a button-only affordance.
      const chev = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chev.setAttribute('viewBox', '0 0 24 24');
      chev.setAttribute('width', '14');
      chev.setAttribute('height', '14');
      chev.setAttribute('aria-hidden', 'true');
      const cp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      cp.setAttribute('fill', 'none');
      cp.setAttribute('stroke', 'currentColor');
      cp.setAttribute('stroke-width', '2');
      cp.setAttribute('stroke-linecap', 'round');
      cp.setAttribute('stroke-linejoin', 'round');
      cp.setAttribute('d', 'M9 6l6 6-6 6');
      chev.appendChild(cp);
      cta.appendChild(chev);
      block.appendChild(cta);
    }
    return block;
  }

  function renderHome() {
    showView('view-home');
    const view = renderInto('home', 'home');
    const container = view.querySelector('.container') || view;

    // Offline banner: sits ABOVE the .container (and therefore above
    // any disruption / geo / nearest-stop banner inside it) so the
    // connectivity state is the most prominent piece of information on
    // the home view when the user has no network.
    applyOfflineBanner();

    // First-run onboarding tip card. Only renders for a brand-new user
    // — once they tap "知道了" (or the ×) we write `buseta.onboarded = 1`
    // into localStorage and the card is gone for good on this device.
    // Sits ABOVE the offline / disruption / geo banners so the very
    // first impression a new install gets is a friendly "here's what
    // this app can do", not a warning about connectivity.
    if (!hasOnboarded()) {
      const onboardCard = buildOnboardCard();
      // Prefer to mount at the very top of the .container, before any
      // banners the applyOfflineBanner() / geo / nearest-stop branches
      // may have just inserted. If for some reason there's no .container
      // we fall back to the view itself — never crash a render for
      // onboarding placement.
      (container || view).insertBefore(onboardCard, (container || view).firstChild);
    }

    // Service-disruption banner: inserted at the very top of the home
    // view, ABOVE the geo banner / nearest-stop pill / operators strip.
    // The snapshot is fetched asynchronously; on each render we keep the
    // banner insertion idempotent — a fresh fetch result re-renders the
    // top element rather than stacking duplicates. While the fetch is
    // still in flight on the very first render the banner simply isn't
    // there (typical round-trip is sub-100ms once the SW has the file).
    fetchDisruptions()
      .then((all) => {
        const matched = disruptionsForUserRoutes(all);
        if (matched.length === 0) return;
        const banner = renderDisruptionBanner(matched);
        if (!banner) return;
        const view = document.getElementById('view-home');
        if (!view || view.hidden) return;
        const cur = view.querySelector('.container') || view;
        // Drop any prior banner so re-renders don't pile up.
        const existing = cur.querySelector('.disruption-banner');
        if (existing) existing.remove();
        cur.insertBefore(banner, cur.firstChild);
      })
      .catch(() => {
        /* fetchDisruptions already swallows — defensive */
      });

    // First-run / empty-state hero: when the user has nothing saved or
    // recent, replace the operators strip + saved/recent sections with a
    // single friendly hero that offers the three primary entry points.
    // The empty state has its own inline location CTA so we skip the
    // standard geo banner / nearest-stop pill in this branch — once the
    // user has any saved or recent activity the populated renderHome
    // path runs and these zones reappear.
    if (
      state.savedRoutes.length === 0 &&
      state.savedStops.length === 0 &&
      state.recent.length === 0
    ) {
      // Strip the cloned template's saved/recent scaffolding so the
      // empty-state hero doesn't sit next to three "未有收藏…" placeholders.
      [
        '.operators-strip',
        '[data-bind="savedRoutes"]',
        '[data-bind="savedStops"]',
        '[data-bind="recent"]',
      ].forEach((sel) => {
        $$(sel, container).forEach((n) => {
          const h = n.previousElementSibling;
          // Remove a sibling section-title <h2> immediately above, if
          // it's a heading that belongs to this empty block (saved
          // routes / stops / recent). Operators strip keeps its own
          // <h2>, but the whole strip is removed wholesale below.
          if (
            h &&
            /^H\d$/.test(h.tagName) &&
            (h.dataset.i18n === 'savedRoutes' ||
              h.dataset.i18n === 'savedStops' ||
              h.dataset.i18n === 'recentSearches')
          ) {
            h.remove();
          }
          n.remove();
        });
      });
      container.insertBefore(buildHomeEmptyState(), container.firstChild);
      applyI18n(view);
      return;
    }

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
      savedRoutesEl.appendChild(
        buildEmptyStateBlock({
          textKey: 'emptyRoutes',
          tipKey: 'emptyFavRoutesTip',
          ctaKey: 'emptyFavRoutesCta',
          ctaHref: '#/search',
        })
      );
    } else {
      const ul = el('div', { class: 'list' });
      state.savedRoutes.forEach((r) => ul.appendChild(routeRow(r)));
      savedRoutesEl.appendChild(ul);
    }

    const savedStopsEl = $('[data-bind="savedStops"]', view);
    if (state.savedStops.length === 0) {
      savedStopsEl.appendChild(
        buildEmptyStateBlock({
          textKey: 'emptyStops',
          tipKey: 'emptyFavStopsTip',
          ctaKey: 'emptyFavStopsCta',
          ctaHref: '#/search',
        })
      );
    } else {
      const ul = el('div', { class: 'list' });
      state.savedStops.forEach((s) => ul.appendChild(stopRow(s)));
      savedStopsEl.appendChild(ul);
    }

    const recentEl = $('[data-bind="recent"]', view);
    if (state.recent.length === 0) {
      recentEl.appendChild(
        buildEmptyStateBlock({
          textKey: 'emptyRecent',
          tipKey: 'emptyRecentTip',
          ctaKey: 'emptyRecentCta',
          ctaHref: '#/search',
        })
      );
    } else {
      const ul = el('div', { class: 'list' });
      state.recent.slice(0, 8).forEach((r) => {
        if (r.stop) {
          // Resolve the name in priority order:
          //   1) cached on the recent entry (set by enrichRecentStop when the
          //      stop view resolved its real name from the operator endpoint)
          //   2) hk-stops.json index lookup (MTR / GMB / LRT / some CTB)
          //   3) KMB operator-ID reverse map (e.g. "ST905" → "大學站")
          //   4) raw operator id (last-resort fallback — better than a 16-char
          //      hash sub-line)
          const idxMeta = state.index && state.index.stops.get(r.stop);
          const opMeta =
            !idxMeta && state.index && state.index.kmbOperatorId
              ? state.index.kmbOperatorId.get(r.stop)
              : null;
          // Self-heal poisoned entries from the previous (buggy) version:
          // if nameTc was cached as the raw operator ID before the reverse
          // map was wired up, replace it with the resolved name now.
          let cachedTc = r.nameTc || '';
          if (cachedTc === r.stop) cachedTc = '';
          const hasName =
            cachedTc ||
            (idxMeta && (idxMeta.nameTc || idxMeta.nameEn)) ||
            (opMeta && (opMeta.nameTc || opMeta.nameEn));
          const row = hasName
            ? {
                stop: r.stop,
                co: r.co || (idxMeta && idxMeta.co) || (opMeta ? 'KMB' : 'STOP'),
                nameTc: cachedTc || (opMeta && opMeta.nameTc) || (idxMeta && idxMeta.nameTc) || '',
                nameSc: r.nameSc || (opMeta && opMeta.nameSc) || (idxMeta && idxMeta.nameSc) || '',
                nameEn: r.nameEn || (opMeta && opMeta.nameEn) || (idxMeta && idxMeta.nameEn) || '',
              }
            : { stop: r.stop, co: r.co || (idxMeta && idxMeta.co) || 'STOP' };
          ul.appendChild(stopRow(row));
        } else if (r.route) {
          // Hydrate the recent item with the current route meta (dest/orig
          // are not stored in localStorage — look them up from the index so
          // the row shows a useful destination instead of an empty string).
          const meta =
            (state.index &&
              (state.index.routes.get(makeRouteKey(r.co, r.route, r.dir, r.service)) ||
                state.index.ctbRoutes.get(makeRouteKey(r.co, r.route, r.dir, r.service)))) ||
            null;
          ul.appendChild(
            routeRow({
              co: r.co,
              route: r.route,
              dir: r.dir,
              service: r.service,
              destTc: meta ? meta.destTc : '',
              destEn: meta ? meta.destEn : '',
              origTc: meta ? meta.origTc : '',
              origEn: meta ? meta.origEn : '',
            })
          );
        }
      });
      recentEl.appendChild(ul);
      recentEl.appendChild(
        el(
          'button',
          {
            class: 'btn-secondary',
            style: 'margin-top: 12px; color: var(--ink); background: var(--bg-soft);',
            onclick: () => {
              state.recent = [];
              persist();
              renderHome();
              toast(t_str('cleared'));
            },
          },
          t_str('clearRecent')
        )
      );
    }

    // Final i18n sweep. The static template was translated inside
    // renderInto() (top of this function), but everything we just
    // appended dynamically — the onboarding card, the empty-state
    // blocks — still carries its raw `data-i18n` attribute. Re-running
    // applyI18n() walks the whole view subtree, including the new
    // nodes, so the user sees the localized copy immediately rather
    // than the raw keys on first render.
    applyI18n(view);

    // Nearby sections: only rendered when location is known. Insert the
    // bind containers into the home template and let populateNearbyInto
    // fill them in (same code path as the search view).
    if (state.userLoc) {
      const opsStrip = view.querySelector('.operators-strip');
      const anchor =
        opsStrip && opsStrip.parentNode === container ? opsStrip.nextSibling : container.firstChild;

      const nearbyStopsBlock = el('div', { 'data-bind': 'nearbyStops' });
      nearbyStopsBlock.appendChild(el('h2', { class: 'section-title' }, t_str('nearbyStops')));
      const nearbyRoutesBlock = el('div', { 'data-bind': 'nearbyRoutes' });
      nearbyRoutesBlock.appendChild(el('h2', { class: 'section-title' }, t_str('nearbyRoutes')));
      const nearbyStationsBlock = el('div', { 'data-bind': 'nearbyStations' });
      nearbyStationsBlock.appendChild(
        el('h2', { class: 'section-title' }, t_str('nearbyStations'))
      );

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

    // Local-notification settings card. The placeholder div lives in the
    // template (see index.html, `data-bind="notifSettings"`); we populate
    // it on every home render so language switches and state toggles
    // reflect immediately. The renderer is a no-op on browsers without
    // Notification API support.
    const notifEl = $('[data-bind="notifSettings"]', view);
    if (notifEl) renderNotifSettings(notifEl);
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
        .map((s) => ({
          s,
          d: busetaUtils.haversine(state.userLoc.lat, state.userLoc.lng, s.lat, s.lng),
        }))
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
    input.addEventListener(
      'input',
      debounce(() => {
        state.lastSearchQ = input.value.trim();
        renderResults();
      }, 120)
    );
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        state.lastSearchQ = '';
        renderResults();
      }
    });

    const clear = $('#searchClear', view);
    clear.hidden = !state.lastSearchQ;
    clear.addEventListener('click', () => {
      input.value = '';
      state.lastSearchQ = '';
      renderResults();
      input.focus();
    });

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
      out.appendChild(
        el(
          'p',
          { class: 'empty', style: 'margin-top: 8px; border-style: solid;' },
          t_str('noFavHint')
        )
      );
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
      const key =
        kind +
        '|' +
        (kind === 'stop' ? data.stop : makeRouteKey(data.co, data.route, data.dir, data.service));
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
        const upgrade = (reg && !prior.regular) || (reg === prior.regular && score > prior.score);
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
          if (score > 0)
            push('route', { ...r, route: code, service: '', dir: '', _lineView: true }, score);
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
  // permission banner. The banner stays mounted across the whole
  // opt-in lifecycle so the user can see what state we're in:
  //   - idle         → "啟用位置" CTA
  //   - pending      → spinner + "定位中…" (gives instant visual confirmation
  //                    that the click was registered, even before the
  //                    browser's native prompt appears)
  //   - denied       → "再試一次" button
  //   - unavailable  → muted "位置不可用" label, no retry
  // Only hide the banner after the user has successfully granted location
  // (state.userLoc is set) — at which point the nearest-stop pill or
  // nearby sections replace it.
  function shouldShowGeoBanner() {
    return !state.userLoc;
  }

  // In-page permission banner. Replaces the auto-prompt that used to fire
  // on first visit: the user must tap the CTA before we call the
  // browser's geolocation API. Hidden on next render after grant/deny.
  //
  // Renders four states:
  //   idle      → "想睇附近嘅車站同路線？" with [啟用位置] CTA
  //   pending   → same copy, button replaced by [定位中…] spinner
  //   denied    → denied message + [再試一次] button (re-runs prompt)
  //   unavailable → unavailable message + no retry (geolocation API missing
  //                 from this browser). The user can still type a search.
  function buildGeoBanner() {
    const status = state.locationStatus;
    const isPending = status === 'pending';
    const isDenied = status === 'denied';
    const isUnavailable = status === 'unavailable';

    const banner = el('div', {
      class: `geo-banner geo-banner--${status}`,
      role: 'region',
      'aria-label': t_str('geoBannerTitle'),
    });
    const iconWrap = el('div', { class: 'geo-banner-icon', 'aria-hidden': 'true' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute(
      'd',
      'M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z'
    );
    svg.appendChild(path);
    iconWrap.appendChild(svg);
    banner.appendChild(iconWrap);

    const body = el('div', { class: 'geo-banner-body' });
    if (isDenied) {
      body.appendChild(el('div', { class: 'geo-banner-title' }, t_str('geoBannerDeniedTitle')));
      body.appendChild(el('div', { class: 'geo-banner-text' }, t_str('geoBannerDeniedBody')));
    } else if (isUnavailable) {
      body.appendChild(
        el('div', { class: 'geo-banner-title' }, t_str('geoBannerUnavailableTitle'))
      );
      body.appendChild(el('div', { class: 'geo-banner-text' }, t_str('geoBannerUnavailableBody')));
    } else {
      body.appendChild(el('div', { class: 'geo-banner-title' }, t_str('geoBannerTitle')));
      body.appendChild(el('div', { class: 'geo-banner-text' }, t_str('geoBannerBody')));
    }
    banner.appendChild(body);

    if (isPending) {
      const spinner = el('span', {
        class: 'geo-banner-cta btn-primary geo-banner-cta--pending',
        'aria-live': 'polite',
      });
      const ring = el('span', { class: 'geo-spinner', 'aria-hidden': 'true' });
      spinner.appendChild(ring);
      spinner.appendChild(document.createTextNode(t_str('locating')));
      spinner.disabled = true;
      banner.appendChild(spinner);
    } else if (isDenied) {
      banner.appendChild(
        el(
          'button',
          {
            class: 'geo-banner-cta btn-primary',
            type: 'button',
            onclick: () => {
              retryLocation();
            },
          },
          t_str('retryLocation')
        )
      );
    } else if (isUnavailable) {
      // No retry — the browser simply doesn't expose geolocation.
      const pill = el(
        'span',
        { class: 'geo-banner-cta geo-banner-cta--muted', 'aria-hidden': 'true' },
        t_str('locationUnavailableShort')
      );
      banner.appendChild(pill);
    } else {
      banner.appendChild(
        el(
          'button',
          {
            class: 'geo-banner-cta btn-primary',
            type: 'button',
            onclick: () => {
              requestLocation();
            },
          },
          t_str('geoBannerCta')
        )
      );
    }

    return banner;
  }

  // "Nearest stop" pre-fill row — looks like a search-box, surfaces the
  // closest stop name with its distance, and clicks through to that stop
  // view. Hidden if location isn't granted or no nearby stops exist.
  function buildNearestStopPill() {
    if (!state.userLoc || !state.index) return null;
    const nearbyStops = Array.from(state.index.stops.values())
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .map((s) => ({
        s,
        d: busetaUtils.haversine(state.userLoc.lat, state.userLoc.lng, s.lat, s.lng),
      }))
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
    path.setAttribute(
      'd',
      'M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'
    );
    svg.appendChild(path);
    left.appendChild(svg);
    row.appendChild(left);

    const main = el('span', { class: 'nearest-stop-main' });
    main.appendChild(el('span', { class: 'nearest-stop-label' }, t_str('nearestStopLabel')));
    main.appendChild(el('span', { class: 'nearest-stop-name' }, name));
    row.appendChild(main);

    row.appendChild(
      el('span', { class: 'nearest-stop-dist nearby-dist' }, busetaUtils.formatDistance(top.d))
    );
    row.appendChild(makeChev());
    return row;
  }

  // ------------------------------------------------------------------
  // Offline banner
  //   Small, persistent banner that sits at the very top of the home
  //   view whenever `navigator.onLine === false`. Communicates that the
  //   app is showing cached / last-known data so the user doesn't think
  //   the (now stale) ETAs are live. Inserted as a direct child of
  //   #view-home — above .container — so it doesn't compete with the
  //   disruption / geo / nearest-stop banners inside the container.
  // ------------------------------------------------------------------

  // Build the offline banner DOM. Trilingual text is interpolated via
  // t_str() (not data-i18n) because the banner is mounted after the
  // template's applyI18n() pass, mirroring how renderDisruptionBanner
  // is built.
  function renderOfflineBanner() {
    const wrap = el('div', {
      class: 'offline-banner',
      role: 'status',
      'aria-live': 'polite',
    });

    // Compact wifi-off glyph. Inline so the banner stays a single DOM
    // node and there's no extra request for an icon font.
    const iconWrap = el('span', { class: 'offline-banner-icon', 'aria-hidden': 'true' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute(
      'd',
      'M2 8.5a16 16 0 0 1 20 0 ' +
        'M5 12.5a11 11 0 0 1 14 0 ' +
        'M8.5 16.5a6 6 0 0 1 7 0 ' +
        'M12 20h.01 ' +
        'M3 3l18 18'
    );
    svg.appendChild(path);
    iconWrap.appendChild(svg);
    wrap.appendChild(iconWrap);

    const body = el('span', { class: 'offline-banner-body' });
    const mode = el('span', { class: 'offline-banner-title' }, t_str('offlineMode'));
    body.appendChild(mode);
    body.appendChild(document.createTextNode(' — '));
    body.appendChild(document.createTextNode(t_str('offlineShowingLastKnown')));
    wrap.appendChild(body);

    return wrap;
  }

  // Mount / unmount the offline banner based on the current offline
  // flag. Safe to call multiple times — drops any stale banner first so
  // repeated renderHome() calls don't pile up duplicates.
  function applyOfflineBanner() {
    const view = document.getElementById('view-home');
    if (!view || view.hidden) return;
    // `:scope > .offline-banner` so we only match direct children,
    // never a nested banner.
    const existing = view.querySelector(':scope > .offline-banner');
    if (existing) existing.remove();
    if (!isOffline) return;
    view.insertBefore(renderOfflineBanner(), view.firstChild);
  }

  // ------------------------------------------------------------------
  // Service-disruption banner
  // ------------------------------------------------------------------
  // Pulls service-disruption notices from the Transport Department's
  // public-data XML feed and projects each notice into one row per
  // affected route, in the shape the rest of the banner pipeline
  // (disruptionsForUserRoutes / renderDisruptionBanner) already
  // expects.
  //
  // The TD feed is the source the original v37-era audit missed:
  // https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Public_Transports.xml
  // — a single ~3.5 MB XML document carrying ~500 active notices
  // (TNID, TrafficNoticesTypeID, Title_{EN,TC,SC}, StartEffectiveDate
  // as DD.MM.YYYY, HTML bodies). It has CORS * and a daily Last-Modified,
  // so we cache it in the SW with a 24h TTL + If-Modified-Since and only
  // touch the network when the cached entry is stale.
  const TD_DISRUPTIONS_URL =
    'https://www.td.gov.hk/datagovhk_tis/traffic-notices/Notices_on_Public_Transports.xml';

  // Helpers used by the TD disruption pipeline (parseTdDate, hktToday,
  // addDays, stripTags, classifyOperator, extractRouteNumbers,
  // classifySeverity) all live in src/utils/date.js,
  // src/utils/disruption-classify.js, and src/utils/text.js. Loaded as
  // classic scripts in index.html BEFORE app.js so they're available on
  // globalThis.busetaUtils.* when this file evaluates.

  let disruptionsCache = null;

  // Loads (and caches) the parsed TD disruption feed. Returns
  // Array<{route, co?, severity, titleTc, titleEn, titleSc, until?}>; an
  // empty array on any failure (network, parse, missing file).
  //
  // The pipeline:
  //   1. fetchText the TD XML (cached by the SW in buseta-td-disruptions-v1
  //      with a 24h TTL + If-Modified-Since, so repeat visits are O(1)).
  //   2. DOMParser → walk <Notice> nodes. parsererror element → [].
  //   3. Drop notices with StartEffectiveDate older than today-30d.
  //   4. Per notice, extract route numbers from TC + EN title and
  //      classify the operator / severity. Notices with no parseable
  //      route numbers (area-wide bus-stop moves etc.) are dropped.
  //   5. Emit one banner item per (notice × route) so a multi-route
  //      "service adjustment" becomes a row per affected route.
  //
  // v40: wired up against the TD XML feed that the original v37 audit
  // missed. The committed assets/disruptions.json snapshot is kept on
  // disk as the revert path — restoring it is a one-line change: drop
  // the TD pipeline body and short-circuit back to `Promise.resolve([])`
  // (or fetch the JSON, as v37/v38 did).
  async function fetchDisruptions() {
    if (disruptionsCache) return disruptionsCache;
    const p = (async () => {
      let xmlText;
      try {
        xmlText = await busetaUtils.fetchText(TD_DISRUPTIONS_URL);
      } catch (_) {
        return [];
      }
      if (typeof xmlText !== 'string' || !xmlText) return [];
      let doc;
      try {
        doc = new DOMParser().parseFromString(xmlText, 'application/xml');
      } catch (_) {
        return [];
      }
      // parsererror element appears at the document root on a malformed
      // XML body — bail out instead of walking a half-parsed tree.
      if (doc.getElementsByTagName('parsererror').length > 0) return [];
      const notices = doc.getElementsByTagName('Notice');
      if (!notices || notices.length === 0) return [];

      const today = busetaUtils.hktToday();
      // Compare strings as YYYY-MM-DD: lexicographic == chronological.
      // Today-30d in HK time so we don't accidentally include notices
      // that started yesterday in UTC but 1+ day ago in HK.
      const cutoff = (() => {
        try {
          const parts = today.split('-');
          const d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
          d.setUTCDate(d.getUTCDate() - 30);
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        } catch (_) {
          return today;
        }
      })();

      const items = [];
      for (let i = 0; i < notices.length; i++) {
        const n = notices[i];
        const titleTc = textOf(n, 'Title_TC');
        const titleEn = textOf(n, 'Title_EN');
        const titleSc = textOf(n, 'Title_SC') || titleTc || titleEn;
        const start = busetaUtils.parseTdDate(textOf(n, 'StartEffectiveDate'));
        // TD feed doesn't carry an EndEffectiveDate in practice (audit:
        // 0 of 536 records) — keep the field name for the day the feed
        // grows one, and so the until-shape stays honest.
        const end = busetaUtils.parseTdDate(textOf(n, 'EndEffectiveDate'));
        if (!start || start < cutoff) continue;
        if (end && end < today) continue;

        // Strip HTML from the content bodies for severity sniffing —
        // the feeds stuff `<div>`, `<strong>` etc. around the same
        // keywords the title uses, and we want the prose text only.
        const contentTc = busetaUtils.stripTags(textOf(n, 'Content_TC'));
        const contentEn = busetaUtils.stripTags(textOf(n, 'Content_EN'));

        const routes = busetaUtils.extractRouteNumbers(titleTc, titleEn);
        if (!routes.length) continue;

        const co = busetaUtils.classifyOperator(titleTc, titleEn);
        const severity = busetaUtils.classifySeverity(titleTc, titleEn, contentTc, contentEn);
        // until = explicit end date when present, otherwise start + 30d
        // so the existing isDisruptionExpired filter keeps the notice
        // visible for the same 30-day window we use for the start cutoff.
        const until = end || busetaUtils.addDays(start, 30);

        // Trilingual title fallback — keep all three fields populated so
        // disruptionTitleFor() in any of the three langs has something
        // to show even when one of the titles is missing in the source.
        const tc = titleTc || titleEn || titleSc;
        const en = titleEn || titleTc || titleSc;
        const sc = titleSc || titleTc || titleEn;

        for (const route of routes) {
          const item = { route, severity, titleTc: tc, titleEn: en, titleSc: sc, until };
          if (co) item.co = co;
          items.push(item);
        }
      }
      return items;
    })();
    disruptionsCache = p;
    return p;
  }

  // Helper: textContent of the first child <tagName> under `parent`.
  // Returns '' when the tag is absent so callers can pass straight into
  // string ops without a null guard.
  function textOf(parent, tagName) {
    if (!parent || !parent.getElementsByTagName) return '';
    const el = parent.getElementsByTagName(tagName)[0];
    return el && el.textContent ? el.textContent : '';
  }

  // Pick the localised title for a disruption item in the current UI
  // language, with a sensible fallback chain (lang → tc → en).
  function disruptionTitleFor(it) {
    if (!it) return '';
    if (state.lang === 'en') return it.titleEn || it.titleTc || it.titleSc || '';
    if (state.lang === 'zh-Hans') return it.titleSc || it.titleTc || it.titleEn || '';
    return it.titleTc || it.titleSc || it.titleEn || '';
  }

  // Build the disruption banner DOM. Returns null when `items` is empty
  // so the caller can skip the insert. The banner collapses by default
  // and expands on tap to reveal per-route titles + an "until" hint when
  // the disruption has an end timestamp.
  function renderDisruptionBanner(items) {
    if (!items || items.length === 0) return null;

    // Sort highest severity first so the banner's tint always reflects
    // the worst active alert for the user's routes.
    const sevRank = (s) => (s === 'severe' ? 2 : s === 'warn' ? 1 : 0);
    const sorted = items.slice().sort((a, b) => sevRank(b.severity) - sevRank(a.severity));
    const top = sorted[0];
    const sevClass =
      top.severity === 'severe' ? 'is-severe' : top.severity === 'warn' ? 'is-warn' : 'is-info';

    const wrap = el('div', {
      class: `disruption-banner ${sevClass}`,
      role: 'region',
      'aria-label': t_str('disruptionBanner'),
    });

    // Severity icon — a small filled triangle that picks up the banner's
    // currentColor so it visually maps to the severity tint.
    const iconWrap = el('div', { class: 'disruption-banner-icon', 'aria-hidden': 'true' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute(
      'd',
      'M12 2 L22 20 H2 Z M12 9 a1.2 1.2 0 0 1 1.2 1.2 v4.6 a1.2 1.2 0 0 1 -2.4 0 v-4.6 A1.2 1.2 0 0 1 12 9 Z M12 16.4 a1.4 1.4 0 1 0 0 2.8 a1.4 1.4 0 0 0 0 -2.8 Z'
    );
    svg.appendChild(path);
    iconWrap.appendChild(svg);
    wrap.appendChild(iconWrap);

    const body = el('div', { class: 'disruption-banner-body' });

    // Header line: "Service alert · 路線 272A"  (label + worst route pill).
    const head = el('div', { class: 'disruption-banner-head' });
    head.appendChild(el('span', { class: 'disruption-banner-label' }, t_str('disruptionBanner')));
    head.appendChild(document.createTextNode(' · '));
    head.appendChild(
      el('span', { class: 'disruption-banner-pill' }, t_str('disruptionForRoute', top.route))
    );
    if (sorted.length > 1) {
      head.appendChild(document.createTextNode(' '));
      head.appendChild(el('span', { class: 'disruption-banner-more' }, `+${sorted.length - 1}`));
    }
    body.appendChild(head);

    // Severity hint line — gives the user a one-line summary of how bad
    // the worst alert is, without forcing them to expand.
    body.appendChild(
      el(
        'div',
        { class: 'disruption-banner-hint' },
        top.severity === 'severe'
          ? t_str('disruptionSeveritySevere')
          : top.severity === 'warn'
            ? t_str('disruptionSeverityWarn')
            : t_str('disruptionSeverityInfo')
      )
    );
    wrap.appendChild(body);

    // Chevron toggle on the right — click toggles the expanded panel.
    const toggle = el('button', {
      class: 'disruption-banner-toggle',
      type: 'button',
      'aria-expanded': 'false',
      'aria-label': t_str('disruptionExpand'),
    });
    const chev = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chev.setAttribute('viewBox', '0 0 24 24');
    chev.setAttribute('width', '18');
    chev.setAttribute('height', '18');
    chev.setAttribute('aria-hidden', 'true');
    const cpath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cpath.setAttribute('fill', 'none');
    cpath.setAttribute('stroke', 'currentColor');
    cpath.setAttribute('stroke-width', '2');
    cpath.setAttribute('stroke-linecap', 'round');
    cpath.setAttribute('stroke-linejoin', 'round');
    cpath.setAttribute('d', 'M6 9l6 6 6-6');
    chev.appendChild(cpath);
    toggle.appendChild(chev);
    wrap.appendChild(toggle);

    // Expanded panel — hidden by default; lists each affected route with
    // its localised title and an "until" hint when present.
    const panel = el('div', { class: 'disruption-banner-panel', hidden: true });
    const list = el('ul', { class: 'disruption-banner-list' });
    sorted.forEach((it) => {
      const li = el('li', { class: 'disruption-banner-item' });
      li.appendChild(
        el('span', { class: 'disruption-banner-pill' }, t_str('disruptionForRoute', it.route))
      );
      const txt = el('span', { class: 'disruption-banner-text' }, disruptionTitleFor(it));
      li.appendChild(txt);
      if (it.until) {
        li.appendChild(
          el('span', { class: 'disruption-banner-until' }, t_str('disruptionUntil', it.until))
        );
      }
      list.appendChild(li);
    });
    panel.appendChild(list);
    wrap.appendChild(panel);

    // Toggle handler — single tap expands, second tap collapses. We also
    // update aria-expanded + the button's label so screen readers track
    // the state.
    const setExpanded = (next) => {
      panel.hidden = !next;
      toggle.setAttribute('aria-expanded', String(next));
      toggle.setAttribute(
        'aria-label',
        next ? t_str('disruptionCollapse') : t_str('disruptionExpand')
      );
      wrap.classList.toggle('is-open', next);
    };
    toggle.addEventListener('click', () => {
      setExpanded(panel.hidden);
    });
    // Whole banner header is tappable too — quicker hit target on mobile.
    head.addEventListener('click', () => {
      setExpanded(panel.hidden);
    });

    return wrap;
  }

  // True when an item's `until` (YYYY-MM-DD, HK end-of-day) is strictly
  // before today's date in HK time. Items without an `until` field are
  // treated as indefinite ("until further notice") and never expire via
  // this check. Unparseable `until` values also fall through to false so
  // a typo doesn't hide a real alert.
  // isDisruptionExpired moved to src/utils/disruptions.js — Phase 3 modularization

  // Filter the curated disruption list down to entries that apply to at
  // least one route in `state.savedRoutes` or the route-shaped entries of
  // `state.recent`. Stops-only recent entries are ignored. When an item
  // declares an operator `co`, it matches only that operator; otherwise
  // any operator carrying that route number matches. Items whose `until`
  // date has already passed are dropped (see isDisruptionExpired) — the
  // curated snapshot has historically kept 3+ day-old alerts pinned.
  function disruptionsForUserRoutes(items) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const wanted = new Map();
    const pushKey = (co, route) => {
      if (co == null || route == null) return;
      wanted.set(`${co}\t${route}`, true);
      wanted.set(`\t${route}`, true);
    };
    (state.savedRoutes || []).forEach((r) => pushKey(r.co, r.route));
    (state.recent || []).forEach((r) => {
      if (r.route) pushKey(r.co, r.route);
    });

    return items.filter((it) => {
      if (!it || !it.route) return false;
      if (busetaUtils.isDisruptionExpired(it)) return false;
      if (it.co) return wanted.has(`${it.co}\t${it.route}`);
      return wanted.has(`\t${it.route}`);
    });
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
      .map((s) => ({ s, d: busetaUtils.haversine(loc.lat, loc.lng, s.lat, s.lng) }))
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
        if (routesBlock)
          routesBlock.appendChild(el('p', { class: 'muted' }, t_str('noNearbyRoutes')));
      }
    } else {
      Promise.allSettled(nearbyStops.map((x) => fetchKmbStopEta(x.s.stop))).then((results) => {
        const routeMap = new Map();
        const stopItems = [];
        results.forEach((rr, i) => {
          const stop = nearbyStops[i].s;
          const dist = nearbyStops[i].d;
          const etas =
            rr.status === 'fulfilled' && rr.value && Array.isArray(rr.value.data)
              ? rr.value.data.filter((e) => e.eta).slice(0, 3)
              : [];
          stopItems.push({ stop, dist, etas });
          etas.forEach((e) => {
            const co = busetaUtils.classifyKmbOp(e.route, '', e.dest_tc || '');
            const key = makeRouteKey(co, e.route, e.dir, e.service_type);
            if (!routeMap.has(key)) {
              routeMap.set(key, {
                co,
                route: e.route,
                dir: e.dir,
                service: e.service_type,
                origTc: '',
                origEn: '',
                destTc: e.dest_tc,
                destEn: e.dest_en,
                firstEta: e.eta,
                etaCount: 1,
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
        if (liveRoutes)
          liveRoutes.replaceChildren(buildNearbyRoutes(Array.from(routeMap.values())));
      });
    }

    // --- Nearby MTR stations (using embedded coords from mtr-stops.json) ---
    const nearbyMtr = Array.from(state.index.mtr.values())
      .filter((st) => st && !st._isLine)
      .filter((st) => Number.isFinite(st.lat) && Number.isFinite(st.lng))
      .map((st) => ({ st, d: busetaUtils.haversine(loc.lat, loc.lng, st.lat, st.lng) }))
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
      Promise.allSettled(
        nearbyMtr.map((x) => {
          const line = (x.st.lines && x.st.lines[0]) || null;
          return line ? fetchMtrSchedule(line, x.st.stop).catch(() => null) : Promise.resolve(null);
        })
      ).then((results) => {
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
      const row = el('a', {
        class: 'row',
        href: `#/stop/${encodeURIComponent(stop.stop)}`,
        tabindex: '0',
      });
      row.appendChild(makeBadge(stop.co || 'STOP'));
      const main = el('div', { class: 'row-main' });
      main.appendChild(el('div', { class: 'row-title' }, name));
      main.appendChild(el('div', { class: 'row-sub' }, busetaUtils.formatDistance(dist)));
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
      const row = el('a', { class: 'row', href, tabindex: '0' });
      row.appendChild(makeBadge('MTR'));
      const main = el('div', { class: 'row-main' });
      main.appendChild(el('div', { class: 'row-title' }, name));
      main.appendChild(
        el(
          'div',
          { class: 'row-sub' },
          `${line ? line + ' · ' : ''}${busetaUtils.formatDistance(item.d)}`
        )
      );
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
          else
            meta.appendChild(
              el(
                'span',
                { class: 'row-eta' + (m <= 2 ? ' is-soon' : '') },
                `${m} ${t_str('minShort')}`
              )
            );
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
        co: r.co,
        route: r.route,
        dir: r.dir,
        service: r.service,
        origTc: r.origTc,
        origEn: r.origEn,
        destTc: r.destTc,
        destEn: r.destEn,
      };
      const row = routeRow(data);
      const meta = $('.row-meta', row);
      meta.appendChild(etaSpan(r.firstEta));
      if (r.etaCount > 1)
        meta.appendChild(el('div', { class: 'row-dim' }, t_str('etaCount', r.etaCount - 1)));
      list.appendChild(row);
    });
    root.appendChild(list);
    return root;
  }

  // haversine + formatDistance moved to src/utils/geo.js — Phase 3 modularization

  // ------------------------------------------------------------------
  // Row builders
  // ------------------------------------------------------------------
  function makeBadge(co) {
    if (co === 'MTR') return el('span', { class: 'row-badge co-MTR', 'aria-label': 'MTR' }, 'M');
    if (co === 'LRT')
      return el('span', { class: 'row-badge co-LRT', 'aria-label': 'Light Rail' }, 'L');
    // Fallback for unknown operators (e.g. a legacy saved stop whose index
    // entry we can't classify). Render a generic bus-stop pin icon rather
    // than a stray "·" character so the row still looks intentional.
    if (co === 'STOP' || !co) {
      const badge = el('span', { class: 'row-badge co-STOP', 'aria-label': 'Bus stop' });
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '22');
      svg.setAttribute('height', '22');
      svg.setAttribute('aria-hidden', 'true');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('fill', 'currentColor');
      p.setAttribute(
        'd',
        'M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z'
      );
      svg.appendChild(p);
      badge.appendChild(svg);
      return badge;
    }
    return el('span', { class: `row-badge co-${co}` }, co);
  }

  function makeChev() {
    return el(
      'span',
      { class: 'chev' },
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

  // QW-2 · Skeleton list — three grey-bone rows with shimmer overlay.
  // Used as the loading placeholder for route-detail / stop-detail live
  // panels and anywhere else that says "載入緊資料…".
  function buildSkeletonList(rows = 4) {
    const wrap = el('div', { class: 'skeleton-list', 'aria-busy': 'true' });
    for (let i = 0; i < rows; i++) {
      const row = el('div', { class: 'skeleton-row' });
      row.appendChild(el('div', { class: 'skeleton-badge' }));
      const lines = el('div', { class: 'skeleton-lines' });
      lines.appendChild(el('div', { class: 'skeleton-line is-long' }));
      lines.appendChild(el('div', { class: 'skeleton-line is-short' }));
      row.appendChild(lines);
      row.appendChild(el('div', { class: 'skeleton-eta' }));
      wrap.appendChild(row);
    }
    return wrap;
  }

  // QW-5 · Rich stop-detail empty state.
  // Replaces the bare "暫無到站時間" with an illustration + title +
  // sub + two CTAs (Schedule + Retry). Mirrors the home empty state.
  function buildStopEmptyState({ onRetry, onSchedule }) {
    const wrap = el('section', {
      class: 'stop-empty',
      role: 'region',
      'aria-label': t_str('settingsEmptyStopTitle'),
    });

    // Inline illustration: a small clock + dashed circle (pure SVG).
    const illo = el('div', { class: 'stop-empty-illustration', 'aria-hidden': 'true' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('width', '40');
    svg.setAttribute('height', '40');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '24');
    circle.setAttribute('cy', '24');
    circle.setAttribute('r', '16');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', 'currentColor');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('stroke-dasharray', '4 4');
    const hand1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hand1.setAttribute('d', 'M24 24V14');
    hand1.setAttribute('stroke', 'currentColor');
    hand1.setAttribute('stroke-width', '2.4');
    hand1.setAttribute('stroke-linecap', 'round');
    hand1.setAttribute('fill', 'none');
    const hand2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hand2.setAttribute('d', 'M24 24L30 30');
    hand2.setAttribute('stroke', 'currentColor');
    hand2.setAttribute('stroke-width', '2.4');
    hand2.setAttribute('stroke-linecap', 'round');
    hand2.setAttribute('fill', 'none');
    svg.appendChild(circle);
    svg.appendChild(hand1);
    svg.appendChild(hand2);
    illo.appendChild(svg);
    wrap.appendChild(illo);

    wrap.appendChild(el('h2', { class: 'stop-empty-title' }, t_str('settingsEmptyStopTitle')));
    wrap.appendChild(el('p', { class: 'stop-empty-sub' }, t_str('settingsEmptyStopSub')));

    const ctas = el('div', { class: 'stop-empty-ctas' });
    if (typeof onSchedule === 'function') {
      ctas.appendChild(
        el(
          'button',
          {
            type: 'button',
            class: 'stop-empty-cta stop-empty-cta--primary',
            onclick: onSchedule,
          },
          t_str('settingsEmptyStopCtaSchedule')
        )
      );
    }
    if (typeof onRetry === 'function') {
      ctas.appendChild(
        el(
          'button',
          {
            type: 'button',
            class: 'stop-empty-cta',
            onclick: onRetry,
          },
          t_str('settingsEmptyStopCtaRetry')
        )
      );
    }
    wrap.appendChild(ctas);
    return wrap;
  }

  // QW-7 · Row focus enhancer. Anchors get tabindex so keyboard users
  // can tab through results, and we attach an aria-label that names the
  // route + destination so screen readers don't just read "link".
  function enhanceRowFocus(rowEl, labelParts) {
    if (!rowEl || rowEl.tagName !== 'A') return rowEl;
    rowEl.setAttribute('tabindex', '0');
    if (labelParts && labelParts.length) {
      rowEl.setAttribute('aria-label', labelParts.filter(Boolean).join(' · '));
    }
    return rowEl;
  }

  // QW-8 · Refresh countdown chip. Render next to the "updated HH:MM"
  // line on route / stop detail. Counts down to the next auto-refresh.
  function buildRefreshProgress(refreshAtMs) {
    const wrap = el('span', { class: 'refresh-progress', 'aria-hidden': 'true' });
    const bar = el('span', { class: 'refresh-progress-bar' });
    const text = el('span', { class: 'refresh-progress-text' });
    wrap.appendChild(text);
    wrap.appendChild(bar);
    const update = () => {
      const ms = Math.max(0, refreshAtMs - Date.now());
      const sec = Math.ceil(ms / 1000);
      text.textContent = t_str('refreshProgressLabel', sec);
      bar.style.setProperty('--refresh-progress', String(Math.max(0, Math.min(1, ms / 60_000))));
    };
    update();
    const id = setInterval(() => {
      if (wrap.isConnected) update();
      else clearInterval(id);
    }, 1000);
    return wrap;
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
      main.appendChild(
        el(
          'div',
          { class: 'row-title' },
          r.route,
          el('span', { style: 'color: var(--muted); margin: 0 6px; font-weight: 500;' }, '·'),
          dest
        )
      );
      main.appendChild(el('div', { class: 'row-sub' }, dest));
      a.appendChild(main);
      a.appendChild(
        el('div', { class: 'row-meta' }, el('div', { class: 'row-dim' }, t_str('line')))
      );
      a.appendChild(makeChev());
      return a;
    }

    const dirLabel =
      r.co === 'MTR' || r.co === 'LRT'
        ? r.dir === 'UP' || r.dir === '1' || r.dir === 'O'
          ? t_str('dirUp')
          : t_str('dirDown')
        : r.dir === 'I'
          ? t_str('inbound')
          : t_str('outbound');
    const dest = pickFirst(r.destTc, r.destEn);
    const orig = pickFirst(r.origTc, r.origEn);
    const displayRoute =
      r.co === 'GMB' && r._region && r._code ? `${r._code} (${r._region})` : r.route;
    const a = el('a', {
      class: 'row',
      href: `#/route/${encodeURIComponent(r.co)}/${encodeURIComponent(r.route)}/${encodeURIComponent(r.dir)}/${encodeURIComponent(r.service)}`,
    });
    a.appendChild(makeBadge(r.co));
    const main = el('div', { class: 'row-main' });
    const titleEl = el('div', { class: 'row-title' });
    titleEl.appendChild(document.createTextNode(displayRoute));
    titleEl.appendChild(
      el('span', { style: 'color: var(--muted); margin: 0 6px; font-weight: 500;' }, '·')
    );
    titleEl.appendChild(document.createTextNode(dest));
    if (r._hasSchool) {
      const schoolPill = el(
        'span',
        { class: 'row-tag row-tag-school', title: t_str('schoolTagTitle') },
        t_str('schoolTag')
      );
      titleEl.appendChild(document.createTextNode(' '));
      titleEl.appendChild(schoolPill);
    }
    main.appendChild(titleEl);
    main.appendChild(
      el('div', { class: 'row-sub' }, r.co === 'GMB' ? orig : `${dirLabel} · ${orig}`)
    );
    a.appendChild(main);
    a.appendChild(
      el(
        'div',
        { class: 'row-meta' },
        el('div', { class: 'row-dim' }, t_str(busetaUtils.opCoKey(r.co)))
      )
    );
    a.appendChild(makeChev());
    return a;
  }

  function stopRow(s) {
    const a = el('a', { class: 'row', href: `#/stop/${encodeURIComponent(s.stop)}` });
    a.appendChild(makeBadge(s.co || 'STOP'));
    const main = el('div', { class: 'row-main' });
    main.appendChild(el('div', { class: 'row-title' }, nameFor(s) || s.stop));
    const subInfo = s.lines
      ? s.lines.join(' · ')
      : s.nameEn || (s.stop ? String(s.stop).slice(0, 12) : '');
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
    else if (minutes <= 0) {
      span.textContent = t_str('arriving');
      span.classList.add('is-now');
    } else if (minutes === 1) {
      span.textContent = `1 ${t_str('minShort')}`;
      span.classList.add('is-soon');
    } else {
      span.textContent = `${minutes} ${t_str('minShort')}`;
      if (minutes <= 2) span.classList.add('is-soon');
    }
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
    banner.appendChild(
      el(
        'span',
        {
          class: 'route-alert-icon',
          'aria-hidden': 'true',
        },
        alertIconSVG(alert.severity)
      )
    );
    banner.appendChild(
      el('span', { class: 'route-alert-text' }, t_str(alert.key, ...(alert.args || [])))
    );
    const dismissKey = `${routeKey}|${alert.key}`;
    const dismissBtn = el(
      'button',
      {
        type: 'button',
        class: 'route-alert-dismiss',
        'aria-label': t_str('dismissAlert'),
        onclick: () => {
          state.dismissedAlerts.add(dismissKey);
          banner.remove();
        },
      },
      '\u00d7'
    ); // ×
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
      c.setAttribute('cx', '12');
      c.setAttribute('cy', '12');
      c.setAttribute('r', '10');
      c.setAttribute('fill', 'currentColor');
      c.setAttribute('fill-opacity', '0.15');
      svg.appendChild(c);
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', '12');
      ring.setAttribute('cy', '12');
      ring.setAttribute('r', '10');
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', 'currentColor');
      ring.setAttribute('stroke-width', '1.6');
      svg.appendChild(ring);
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      bar.setAttribute('d', 'M12 7v6');
      bar.setAttribute('stroke', 'currentColor');
      bar.setAttribute('stroke-width', '2');
      bar.setAttribute('stroke-linecap', 'round');
      bar.setAttribute('fill', 'none');
      svg.appendChild(bar);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', '12');
      dot.setAttribute('cy', '16.5');
      dot.setAttribute('r', '1.1');
      dot.setAttribute('fill', 'currentColor');
      svg.appendChild(dot);
    } else {
      // Triangle with bang — heads-up but not service-stopped.
      const tri = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tri.setAttribute('d', 'M12 3.2 L22 20.5 L2 20.5 Z');
      tri.setAttribute('fill', 'currentColor');
      tri.setAttribute('fill-opacity', '0.15');
      tri.setAttribute('stroke', 'currentColor');
      tri.setAttribute('stroke-width', '1.6');
      tri.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(tri);
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      bar.setAttribute('d', 'M12 9v5.5');
      bar.setAttribute('stroke', 'currentColor');
      bar.setAttribute('stroke-width', '2');
      bar.setAttribute('stroke-linecap', 'round');
      bar.setAttribute('fill', 'none');
      svg.appendChild(bar);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', '12');
      dot.setAttribute('cy', '17');
      dot.setAttribute('r', '1.1');
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

    // Build direction pills: same route, other bound(s) — and service-type
    // sub-tabs (主線 / 特別班 2 / 3 / 4) within the current bound, justarrived-
    // style. When only 1 bound + 1 service exists, neither is rendered.
    // swapTarget is also extracted so the bound-swap button can offer an
    // in-place O ↔ I flip without going back to search.
    const dirPills = buildDirectionPills(r.co, r.route, r.dir, r.service);
    const { boundPills, servicePills, swapTarget } = dirPills;
    header.appendChild(
      buildRouteHeader({
        co: r.co,
        route: r.route,
        dir: r.dir,
        service: r.service,
        dest,
        orig,
        origEn,
        dirLabel,
        fare: meta && meta.fares && meta.fares[0],
        boundPills,
        servicePills,
        swapTarget,
        currentDirKey: key,
        // fareMin/fareMax are filled in once the fare fetch resolves —
        // `null`/`null` (i.e. absent) preserves the legacy "head fare"
        // behaviour when the upstream returns no fare data.
        fareMin: null,
        fareMax: null,
      })
    );
    // QW-2: skeleton placeholders replace the bare loading text on
    // bus-route detail while we wait for the ETA response.
    body.appendChild(buildSkeletonList(6));
    // /route-stop; CTB / NWFB use the Citybus endpoint.
    const isCitybus = r.co === 'CTB' || r.co === 'NWFB';
    const fetchRouteStop = isCitybus
      ? () => fetchCitybusRouteStop(r.route, r.dir)
      : () => fetchKmbRouteStop(r.route, r.dir, r.service);
    // Kick off the fare fetch in parallel with the route-stop fetch.
    // KMB / LWB use the upstream /route-fare (per-stop seq); CTB / NWFB
    // expose only a flat single-route fare (per upstream `route-fare/ctb`
    // which currently 422s, or `assets/ctb-fares.json` as the fallback).
    // The promise resolves to either a Map<seq, fare> or a single number,
    // which `expandFareForStops` will flatten into a Map<seq, fare> below.
    const fareP = (() => {
      if (r.co === 'CTB' || r.co === 'NWFB') return fetchCitybusRouteFare(r.route, r.dir);
      // KMB / LWB share the etabus endpoint.
      return fetchKmbRouteFare(r.route, r.dir, r.service);
    })();
    fetchRouteStop()
      .then(async (resp) => {
        const items = resp && Array.isArray(resp.data) ? resp.data : [];
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

        // Wait for the fare promise (already in flight above) and expand it
        // into a Map<seq, fare> suitable for the row loop. Errors are swallowed
        // and result in `null` (UI shows `—` chip per stop rather than an
        // empty placeholder, so the user sees "no fare data" vs "broken").
        let fareBySeq = null;
        let fareAttempted = false;
        try {
          const rawFare = await fareP;
          fareAttempted = true;
          fareBySeq = expandFareForStops(rawFare, stops);
        } catch (e) {
          fareAttempted = true;
          fareBySeq = null;
        }
        const fareRangeInfo = fareRange(fareBySeq);

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
            etaByStop.set(
              s.stop,
              rr.value.data
                .filter(
                  (e) =>
                    e.route === r.route &&
                    (isCitybus || (e.dir === r.dir && String(e.service_type) === String(r.service)))
                )
                .filter((e) => !!e.eta)
                .sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime())
            );
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
          await Promise.all(
            missingStops.map(async (s) => {
              const c = await ensureStopCoords(s.stop, isCitybus);
              if (c) coordByStop.set(s.stop, c);
            })
          );
        }
        // (The route-map iframe is built below from `coordByStop`. We build
        // the inner SVG schematic first so we can nest it inside the same
        // card — see renderRouteMap(stops, coordByStop, innerSchematic).)

        const list = el('div', { class: 'eta-list' });
        // Pick the row that should be highlighted (the user's current stop)
        // and remember its DOM node so we can scroll it into view below.
        let targetRow = null;
        const targetSeq = r.stopSeq && /^\d+$/.test(r.stopSeq) ? parseInt(r.stopSeq, 10) : null;
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
          const row = el('a', {
            class: classes.join(' '),
            href: `#/stop/${encodeURIComponent(s.stop)}`,
            tabindex: '0',
          });
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
          const enDisplay = fetchedName ? fetchedName.nameEn : s.nameEn || '';
          info.appendChild(el('div', { class: 'stop-name-row' }, nameDisplay || s.stop));
          if (enDisplay) info.appendChild(el('div', { class: 'stop-name-en' }, enDisplay));
          // Operator stop code (e.g. "ST905", "PA100") — justarrived-style
          // small gray text under the English stop name. We only render it
          // when it looks like an operator code (short alphanumeric, 2-6
          // chars) rather than a hash ID — hk-stops.json hashes are 16 hex
          // chars and would be ugly noise here. KMB upstream already returns
          // names that include the operator code in parens (e.g. "大學站 (ST905)"),
          // so the displayed name and the code share context; we skip the
          // separate code line when it's redundant.
          if (s.stop && /^[A-Z0-9]{2,6}$/i.test(s.stop) && s.stop !== nameDisplay) {
            info.appendChild(el('div', { class: 'stop-code' }, s.stop));
          }
          // Fare row: pill (or `—` chip) + optional "起點" marker on origin.
          //   - fare known  → `$X.X` (KMB per-stop, or flat-fare CTB/GMB/LRT)
          //   - fare attempted but null → `—` chip in muted style
          //   - fare not yet attempted → nothing (still loading)
          // 起點 marker is shown on the origin stop regardless of fare status,
          // so users can always tell where the route starts (justarrived-style).
          const fareRow = el('div', { class: 'stop-fare-row' });
          const stopFare = fareBySeq && fareBySeq.get(seq);
          if (stopFare != null && Number.isFinite(Number(stopFare))) {
            fareRow.appendChild(
              el('span', { class: 'stop-fare' }, `$${fmtFare(Number(stopFare))}`)
            );
          } else if (fareAttempted) {
            const chip = el('span', { class: 'stop-fare is-na' }, '—');
            chip.title = t_str('fareUnavailable');
            fareRow.appendChild(chip);
          }
          if (isOrigin)
            fareRow.appendChild(el('span', { class: 'stop-origin-marker' }, t_str('fareOrigin')));
          if (fareRow.children.length > 0) info.appendChild(fareRow);
          row.appendChild(info);
          // ETA column (justarrived-style): big relative + absolute time,
          // then up to two more upcoming arrivals as "X 分鐘 · HH:MM".
          const etaBox = el('div', { class: 'stop-eta' });
          const etas = etaByStop.get(s.stop) || [];
          if (etas.length > 0) {
            const bigLine = el('div', { class: 'big-line' });
            const big = el('span', { class: 'big' });
            const m = minutesUntil(etas[0].eta);
            if (m == null) big.textContent = '–';
            else if (m <= 0) {
              big.textContent = t_str('arriving');
              big.classList.add('is-now');
            } else {
              big.textContent = `${m} ${t_str('minShort')}`;
              if (m <= 2) big.classList.add('is-soon');
            }
            bigLine.appendChild(big);
            const abs0 = formatHMTimestamp(etas[0].eta);
            if (abs0) bigLine.appendChild(el('span', { class: 'abs-time' }, abs0));
            etaBox.appendChild(bigLine);
            // Up to 2 more upcoming arrivals (skip etas[0] which we just shown).
            const nextList = el('div', { class: 'eta-next-list' });
            for (let i = 1; i < Math.min(etas.length, 3); i++) {
              const nm = minutesUntil(etas[i].eta);
              const nextAbs = formatHMTimestamp(etas[i].eta);
              if (nm != null && nextAbs) {
                nextList.appendChild(
                  el('div', { class: 'eta-next' }, `${nm} ${t_str('minShort')} · ${nextAbs}`)
                );
              }
            }
            if (nextList.children.length > 0) etaBox.appendChild(nextList);
            // If there are even more arrivals (4+), show a small "仲有 N 班"
            // hint so users on busy lines know more buses are coming.
            if (etas.length > 3) {
              etaBox.appendChild(
                el('div', { class: 'small more' }, t_str('etaCount', etas.length - 3))
              );
            } else if (etas[0].rmk_en === 'Scheduled Bus' && etas.length === 1) {
              etaBox.appendChild(el('div', { class: 'small more' }, t_str('scheduled')));
            }
            // Leading-arrival remark drives the route-level cancelled/delayed
            // banner. We only check etas[0] per the spec — earlier arrivals
            // have already passed, so flagging them would mislead the user.
            if (CRITICAL_RMK.has(etas[0].rmk_en)) affectedStops++;
          } else if (idx === 0) {
            etaBox.appendChild(el('span', { class: 'small' }, t_str('loading')));
          } else {
            etaBox.appendChild(
              el('span', { class: 'small', style: 'color: var(--muted-2);' }, t_str('noEta'))
            );
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
        const alertEl =
          !state.dismissedAlerts.has(`${routeKey}|${alerts[0] && alerts[0].key}`) && alerts.length
            ? renderRouteAlert(alerts[0], routeKey)
            : null;

        const heading = el('h2', { class: 'section-title' }, t_str('showingStop', stops.length));
        // ---- Route-level map (Google Maps iframe) ----
        // v30 hybrid dropped the SVG schematic because users found the
        // combined iframe + schematic card was unwieldy — the iframe
        // sometimes lazy-loaded at a smaller size and the SVG stretched
        // to fill the leftover space, breaking the layout. v31 keeps just
        // the Google Maps iframe as the single map; the live-bus schematic
        // is dropped from this view. The vehicle-positions helper
        // (`assets/vehicle-positions.js`) and `renderVehicleMap()` are
        // kept on disk for future use, but no longer rendered here.
        const routeMapEl = renderRouteMap(stops, coordByStop);
        // Order: optional alert → route map card (Google Maps iframe +
        // open-in-maps link) → stop list heading → rows.
        const children = [];
        if (alertEl) children.push(alertEl);
        if (routeMapEl) children.push(routeMapEl);
        children.push(heading, list);
        body.replaceChildren(...children);
        // (Removed in v31: live-GPS probe + 30s polling — the SVG schematic
        // is no longer rendered on the route detail page, so there's no DOM
        // node to swap the live positions into. The vehicle-positions helper
        // and the probe / refresh helpers stay defined in case we wire them
        // back in later.)
        // Refresh the header so the fare-range (or single flat fare) shows
        // up under the destination line. Built from the same opts object the
        // initial header was rendered with, but with the new fareMin/fareMax.
        if (fareRangeInfo) {
          try {
            header.replaceChildren(
              ...buildRouteHeader({
                co: r.co,
                route: r.route,
                dir: r.dir,
                service: r.service,
                dest,
                orig,
                origEn,
                dirLabel,
                fare: fareRangeInfo.min === fareRangeInfo.max ? fareRangeInfo.max : null,
                boundPills,
                servicePills,
                swapTarget,
                currentDirKey: key,
                fareMin: fareRangeInfo.min,
                fareMax: fareRangeInfo.max,
              }).childNodes
            );
          } catch (e) {
            /* leave the initial header */
          }
        }
        // Anchor the view at the user's current stop, justarrived-style.
        if (targetRow) {
          requestAnimationFrame(() => {
            try {
              targetRow.scrollIntoView({ behavior: 'auto', block: 'center' });
            } catch {}
          });
        }
      })
      .catch((err) => {
        // Log the underlying error so debugging isn't a guessing game.
        // Previously this catch silently swallowed everything — which
        // masked real bugs (e.g. vehicle-map crashes that wiped a
        // perfectly-good stop list and replaced it with "搵唔到呢條路線").
        console.error('renderBusRoute failed:', err);
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

    header.appendChild(
      buildRouteHeader({
        co: 'MTR',
        route: lineCode,
        dir: 'LINE',
        service: '',
        dest: lineLabel,
        orig: t_str('allLines'),
        origEn: lineMeta ? lineMeta.origEn : '',
        dirLabel: '',
        fare: null,
        directions: [],
        currentDirKey: `MTR|${lineCode}|LINE|`,
      })
    );
    body.appendChild(buildSkeletonList(8));
    // Pull from state.index.mtr lines: each MTR station entry has lines:[...].
    const stations = [];
    const seen = new Set();
    state.index.mtr.forEach((st, code) => {
      if (st._isLine) return;
      if (st.lines && st.lines.includes(lineCode)) {
        // Use dir+code to find sequence.
        const seq = st._dirs && st._dirs.length ? st._seq || 0 : 0;
        if (!seen.has(code)) {
          seen.add(code);
          stations.push({ code, ...st });
        }
      }
    });

    // For each station, fetch ETA concurrently.
    Promise.allSettled(stations.map((s) => fetchMtrSchedule(lineCode, s.code)))
      .then((results) => {
        const list = el('div', { class: 'eta-list' });
        stations.forEach((s, idx) => {
          const rr = results[idx];
          let upNext = null,
            downNext = null;
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
          const minutes = upNext && upNext.ttnt != null ? parseInt(upNext.ttnt, 10) : null;
          if (minutes == null || Number.isNaN(minutes)) {
            etaBox.appendChild(
              el('span', { class: 'small', style: 'color: var(--muted-2);' }, t_str('noEta'))
            );
          } else if (minutes <= 0) {
            etaBox.appendChild(el('span', { class: 'big is-now' }, t_str('arriving')));
          } else {
            etaBox.appendChild(
              el(
                'span',
                { class: 'big' + (minutes <= 2 ? ' is-soon' : '') },
                `${minutes} ${t_str('minShort')}`
              )
            );
          }
          row.appendChild(etaBox);
          list.appendChild(row);
        });
        body.replaceChildren(
          el('h2', { class: 'section-title' }, t_str('showingStop', stations.length)),
          list
        );
      })
      .catch(() => {
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

    header.appendChild(
      buildRouteHeader({
        co: 'MTR',
        route: stationCode,
        dir: 'STATION',
        service: '',
        dest: stationName,
        orig: stationLines.join(' · '),
        origEn: station ? station.nameEn : '',
        dirLabel: '',
        fare: null,
        directions: [],
        currentDirKey: `MTR|${stationCode}|STATION|`,
      })
    );
    body.innerHTML = '';
    body.appendChild(buildSkeletonList(4));
    Promise.allSettled(stationLines.map((line) => fetchMtrSchedule(line, stationCode)))
      .then((results) => {
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
      })
      .catch(() => {
        body.innerHTML = '';
        body.appendChild(el('p', { class: 'empty' }, t_str('noEta')));
      });

    startEtaRefresh(renderRouteDetail);
  }

  function renderMtrLineSection(lineCode, lineName, d) {
    const wrap = el('div', { class: 'eta-section' });
    const title = el(
      'h2',
      { class: 'section-title' },
      el(
        'span',
        {
          class: 'route-badge',
          style: 'display: inline-block; vertical-align: middle; margin-right: 8px;',
        },
        lineCode
      ),
      lineName
    );
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
      const dirLabel =
        g.dir === 'UP' || g.dir === 'UT' || g.dir === 'LMC-UT' ? t_str('dirUp') : t_str('dirDown');
      const heading = el('div', { class: 'eta-dir' }, `${dirLabel} · ${t_str('trains')}`);
      wrap.appendChild(heading);
      const list = el('div', { class: 'eta-list' });
      g.trains.slice(0, 4).forEach((tr) => {
        const row = el('div', { class: 'eta-row' });
        const time = el('div', { class: 'eta-time' });
        const m = parseInt(tr.ttnt, 10);
        if (!Number.isNaN(m)) {
          if (m <= 0) {
            time.textContent = t_str('arriving');
            time.classList.add('is-now');
          } else {
            time.textContent = `${m} ${t_str('minShort')}`;
            if (m <= 2) time.classList.add('is-soon');
          }
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

    const lrtDirPills = buildDirectionPills('LRT', r.route, meta.dir || '1', '');
    header.appendChild(
      buildRouteHeader({
        co: 'LRT',
        route: r.route,
        dir: meta.dir || '1',
        service: '',
        dest: pickFirst(meta.destTc, meta.destEn),
        orig: pickFirst(meta.origTc, meta.origEn),
        origEn: meta.destEn || '',
        dirLabel,
        fare: null,
        ...lrtDirPills,
        currentDirKey: `LRT|${r.route}|${meta.dir || '1'}|`,
        fareMin: null,
        fareMax: null,
      })
    );
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    // LRT flat fare: assets/lrt-fares.json keyed by route number.
    const lrtFareP = fetchLrtRouteFare(r.route);

    // Fetch LRT schedules for every stop on this route (capped concurrency).
    fetchStopsWithCap(stopsForDir, 8, (s) => fetchLrtSchedule(s.id || s.stop))
      .then((results) => {
        const etaByStop = new Map();
        stopsForDir.forEach((s, i) => {
          const rr = results[i];
          if (
            rr &&
            rr.status === 'fulfilled' &&
            rr.value &&
            Array.isArray(rr.value.platform_list)
          ) {
            const trains = [];
            for (const p of rr.value.platform_list) {
              for (const tr of p.route_list || []) {
                if (String(tr.route_no) === String(r.route) && tr.time_ch) {
                  trains.push({
                    route_no: tr.route_no,
                    dest_ch: tr.dest_ch,
                    time_ch: tr.time_ch,
                    time_en: tr.time_en,
                    special: tr.special,
                  });
                }
              }
            }
            etaByStop.set(s.stop, trains);
          }
        });

        // Resolve flat fare + expand onto each stop row. The LRT stops
        // already carry a `seq` from the route JSON, so we copy it onto
        // `_seq` for the expand helper.
        const stopsWithSeq = stopsForDir.map((s, idx) => Object.assign({}, s, { _seq: idx + 1 }));
        return lrtFareP
          .then((flat) => {
            const lrtFareBySeq = expandFareForStops(flat, stopsWithSeq);
            const lrtFareRange = fareRange(lrtFareBySeq);
            if (lrtFareRange) {
              try {
                header.replaceChildren(
                  ...buildRouteHeader({
                    co: 'LRT',
                    route: r.route,
                    dir: meta.dir || '1',
                    service: '',
                    dest: pickFirst(meta.destTc, meta.destEn),
                    orig: pickFirst(meta.origTc, meta.origEn),
                    origEn: meta.destEn || '',
                    dirLabel,
                    fare: lrtFareRange.min === lrtFareRange.max ? lrtFareRange.max : null,
                    ...lrtDirPills,
                    currentDirKey: `LRT|${r.route}|${meta.dir || '1'}|`,
                    fareMin: lrtFareRange.min,
                    fareMax: lrtFareRange.max,
                  }).childNodes
                );
              } catch (e) {
                /* leave the initial header */
              }
            }
            return lrtFareBySeq;
          })
          .catch(() => null)
          .then((lrtFareBySeq) => {
            const list = el('div', { class: 'eta-list' });
            stopsForDir.forEach((s, idx) => {
              const isOrigin = idx === 0;
              const row = el('a', {
                class: `stop-row${isOrigin ? ' is-origin' : ''}`,
                href: `#/stop/${encodeURIComponent(s.stop)}`,
              });
              row.appendChild(el('span', { class: 'stop-idx' }, String(idx + 1)));
              const stopMeta = state.index.lrt.stops.get(s.stop);
              const info = el('div', { class: 'stop-info' });
              const nameText = stopMeta ? nameFor(stopMeta) : s.stop;
              info.appendChild(el('div', { class: 'stop-name-row' }, nameText));
              if (stopMeta && stopMeta.nameEn)
                info.appendChild(el('div', { class: 'stop-name-en' }, stopMeta.nameEn));
              // LRT stop code (e.g. "TR01") — small gray text under English name.
              // Skip if it's a hash ID (16 hex chars) — those are noise.
              if (s.stop && /^[A-Z0-9]{2,6}$/i.test(s.stop) && s.stop !== nameText) {
                info.appendChild(el('div', { class: 'stop-code' }, s.stop));
              }
              // Per-stop fare pill (LRT: same flat fare on every row, or `—`
              // when the LRT route isn't in our hardcoded fares table). 起點
              // marker is always shown on the origin stop, even without fare data.
              const fareRow = el('div', { class: 'stop-fare-row' });
              const stopFare = lrtFareBySeq && lrtFareBySeq.get(idx + 1);
              if (stopFare != null && Number.isFinite(Number(stopFare))) {
                fareRow.appendChild(
                  el('span', { class: 'stop-fare' }, `$${fmtFare(Number(stopFare))}`)
                );
              } else {
                const chip = el('span', { class: 'stop-fare is-na' }, '—');
                chip.title = t_str('fareUnavailable');
                fareRow.appendChild(chip);
              }
              if (isOrigin)
                fareRow.appendChild(
                  el('span', { class: 'stop-origin-marker' }, t_str('fareOrigin'))
                );
              info.appendChild(fareRow);
              row.appendChild(info);
              const etaBox = el('div', { class: 'stop-eta' });
              const trains = etaByStop.get(s.stop) || [];
              if (trains.length > 0) {
                const bigLine = el('div', { class: 'big-line' });
                const big = el('span', { class: 'big' });
                const minutes = parseInt(trains[0].time_en, 10);
                if (Number.isFinite(minutes)) {
                  big.textContent = `${minutes} ${t_str('minShort')}`;
                  if (minutes <= 2) big.classList.add('is-soon');
                } else {
                  big.textContent = trains[0].time_ch || trains[0].time_en || '–';
                }
                bigLine.appendChild(big);
                etaBox.appendChild(bigLine);
                // Up to 2 more upcoming LRT trains (LRT upstream gives only
                // minutes, no absolute timestamps, so we omit the · HH:MM).
                const nextList = el('div', { class: 'eta-next-list' });
                for (let i = 1; i < Math.min(trains.length, 3); i++) {
                  const nm = parseInt(trains[i].time_en, 10);
                  if (Number.isFinite(nm)) {
                    nextList.appendChild(
                      el('div', { class: 'eta-next' }, `${nm} ${t_str('minShort')}`)
                    );
                  }
                }
                if (nextList.children.length > 0) etaBox.appendChild(nextList);
                if (trains.length > 3) {
                  etaBox.appendChild(
                    el('div', { class: 'small more' }, t_str('etaCount', trains.length - 3))
                  );
                } else if (trains[0].special && trains.length === 1) {
                  etaBox.appendChild(el('div', { class: 'small more' }, t_str('scheduled')));
                }
              } else if (idx === 0) {
                etaBox.appendChild(el('span', { class: 'small' }, t_str('loading')));
              } else {
                etaBox.appendChild(
                  el('span', { class: 'small', style: 'color: var(--muted-2);' }, t_str('noEta'))
                );
              }
              row.appendChild(etaBox);
              list.appendChild(row);
            });
            body.replaceChildren(
              el('h2', { class: 'section-title' }, t_str('showingStop', stopsForDir.length)),
              list
            );
          });
      })
      .catch(() => {
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
    const displayRoute =
      meta && meta._region && meta._code ? `${meta._code} (${meta._region})` : r.route;
    const gmbDirPills = buildDirectionPills('GMB', r.route, r.dir || '1', r.service);
    if (!meta || !meta._routeId) {
      body.replaceChildren(el('p', { class: 'muted' }, t_str('loadingRoutes')));
      header.appendChild(
        buildRouteHeader({
          co: 'GMB',
          route: displayRoute,
          dir: r.dir || '1',
          service: r.service,
          dest: r.route,
          orig: '',
          origEn: '',
          dirLabel: '',
          ...gmbDirPills,
          currentDirKey: makeRouteKey('GMB', r.route, r.dir || '1', r.service),
        })
      );
      if (r._region && r._code) {
        fetchGmbRoute(r._region, r._code)
          .then((resp) => {
            const arr = resp && Array.isArray(resp.data) ? resp.data : [];
            const found = arr.find((x) => String(x.route_id) === String(r.service));
            if (found) renderGmbRouteAfterMeta(view, header, body, r, found);
          })
          .catch(() => body.replaceChildren(el('p', { class: 'empty' }, t_str('routeNotFound'))));
      }
      return;
    }
    header.appendChild(
      buildRouteHeader({
        co: 'GMB',
        route: displayRoute,
        dir: r.dir,
        service: r.service,
        dest: pickFirst(meta.destTc, meta.destEn),
        orig: pickFirst(meta.origTc, meta.origEn),
        origEn: meta.origEn || '',
        dirLabel: '',
        fare: null,
        ...gmbDirPills,
        currentDirKey: makeRouteKey('GMB', r.route, r.dir, r.service),
        fareMin: null,
        fareMax: null,
      })
    );
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    // Kick off the GMB flat fare fetch in parallel with route-stop.
    // GMB upstream doesn't expose a per-stop fare endpoint, so this is
    // purely a hardcoded assets/gmb-fares.json lookup keyed by
    // `${region}/${code}`.
    const gmbFareP = fetchGmbRouteFare(meta._region, meta._code, r.route);

    // Fetch stops for the chosen direction.
    fetchGmbRouteStops(meta._routeId, parseInt(r.dir, 10) || 1)
      .then(async (resp) => {
        const stopsRaw = (resp && resp.data && resp.data.route_stops) || [];
        const stops = stopsRaw
          .sort((a, b) => a.stop_seq - b.stop_seq)
          .map((it) => {
            const known = state.index.stops.get(String(it.stop_id));
            return known || { stop: String(it.stop_id), nameTc: it.name_tc, nameEn: it.name_en };
          });
        // Normalise `seq` onto each stop so expandFareForStops works.
        stops.forEach((s, idx) => {
          s._seq = idx + 1;
        });
        // ETA for every stop on the route, capped concurrency.
        const etaResults = await fetchStopsWithCap(stops, 8, (s) =>
          fetchGmbStopEta(meta._routeId, parseInt(r.dir, 10) || 1, parseInt(s.stop, 10) || 0)
        );
        const etaByStop = new Map();
        stops.forEach((s, i) => {
          const rr = etaResults[i];
          if (rr && rr.status === 'fulfilled' && rr.value && rr.value.data && rr.value.data.eta) {
            etaByStop.set(s.stop, rr.value.data.eta);
          }
        });
        // Resolve the flat fare and expand it onto every stop.
        let gmbFareBySeq = null;
        try {
          const flat = await gmbFareP;
          gmbFareBySeq = expandFareForStops(flat, stops);
        } catch (e) {
          gmbFareBySeq = null;
        }
        const gmbFareRange = fareRange(gmbFareBySeq);
        // Refresh header to show the flat fare range under the destination.
        if (gmbFareRange) {
          try {
            header.replaceChildren(
              ...buildRouteHeader({
                co: 'GMB',
                route: displayRoute,
                dir: r.dir,
                service: r.service,
                dest: pickFirst(meta.destTc, meta.destEn),
                orig: pickFirst(meta.origTc, meta.origEn),
                origEn: meta.origEn || '',
                dirLabel: '',
                fare: gmbFareRange.min === gmbFareRange.max ? gmbFareRange.max : null,
                ...gmbDirPills,
                currentDirKey: makeRouteKey('GMB', r.route, r.dir, r.service),
                fareMin: gmbFareRange.min,
                fareMax: gmbFareRange.max,
              }).childNodes
            );
          } catch (e) {
            /* leave the initial header */
          }
        }
        const list = el('div', { class: 'eta-list' });
        // Anchor at the user's current stop_seq if supplied.
        let targetRow = null;
        const targetSeq = r.stopSeq && /^\d+$/.test(r.stopSeq) ? parseInt(r.stopSeq, 10) : null;
        stops.forEach((s, idx) => {
          const seq = idx + 1;
          const isOrigin = idx === 0;
          const isTarget = targetSeq && seq === targetSeq;
          const classes = ['stop-row'];
          if (isOrigin) classes.push('is-origin');
          if (isTarget) classes.push('is-target');
          const row = el('a', {
            class: classes.join(' '),
            href: `#/stop/${encodeURIComponent(s.stop)}`,
          });
          row.appendChild(el('span', { class: 'stop-idx' }, String(seq)));
          if (isTarget) {
            row.dataset.targetSeq = String(seq);
            targetRow = row;
          }
          const info = el('div', { class: 'stop-info' });
          const nameText = nameFor(s) || s.stop;
          info.appendChild(el('div', { class: 'stop-name-row' }, nameText));
          if (s.nameEn) info.appendChild(el('div', { class: 'stop-name-en' }, s.nameEn));
          // GMB stop code (numeric operator stop ID) — small gray under name.
          // Skip hash IDs (16 hex chars) which are hk-stops.json internals.
          if (s.stop && /^[A-Z0-9]{2,6}$/i.test(s.stop) && s.stop !== nameText) {
            info.appendChild(el('div', { class: 'stop-code' }, s.stop));
          }
          // Per-stop fare pill (GMB: same flat fare on every row, or `—`
          // when the GMB route isn't in our hardcoded fares table). 起點
          // marker is always shown on the origin stop, even without fare data.
          const fareRow = el('div', { class: 'stop-fare-row' });
          const stopFare = gmbFareBySeq && gmbFareBySeq.get(seq);
          if (stopFare != null && Number.isFinite(Number(stopFare))) {
            fareRow.appendChild(
              el('span', { class: 'stop-fare' }, `$${fmtFare(Number(stopFare))}`)
            );
          } else {
            const chip = el('span', { class: 'stop-fare is-na' }, '—');
            chip.title = t_str('fareUnavailable');
            fareRow.appendChild(chip);
          }
          if (isOrigin)
            fareRow.appendChild(el('span', { class: 'stop-origin-marker' }, t_str('fareOrigin')));
          info.appendChild(fareRow);
          row.appendChild(info);
          const etaBox = el('div', { class: 'stop-eta' });
          const etas = etaByStop.get(s.stop) || [];
          if (etas.length > 0) {
            const bigLine = el('div', { class: 'big-line' });
            const big = el('span', { class: 'big' });
            const m = parseInt(etas[0].diff, 10);
            if (Number.isFinite(m)) {
              big.textContent = `${m} ${t_str('minShort')}`;
              if (m <= 2) big.classList.add('is-soon');
            } else {
              big.textContent = '–';
            }
            bigLine.appendChild(big);
            etaBox.appendChild(bigLine);
            // Up to 2 more upcoming GMB arrivals (GMB upstream gives
            // only minutes — no absolute timestamps — so we omit · HH:MM).
            const nextList = el('div', { class: 'eta-next-list' });
            for (let i = 1; i < Math.min(etas.length, 3); i++) {
              const nm = parseInt(etas[i].diff, 10);
              if (Number.isFinite(nm)) {
                nextList.appendChild(
                  el('div', { class: 'eta-next' }, `${nm} ${t_str('minShort')}`)
                );
              }
            }
            if (nextList.children.length > 0) etaBox.appendChild(nextList);
            if (etas.length > 3) {
              etaBox.appendChild(
                el('div', { class: 'small more' }, t_str('etaCount', etas.length - 3))
              );
            } else if (etas[0].remarks_en === 'Scheduled' && etas.length === 1) {
              etaBox.appendChild(el('div', { class: 'small more' }, t_str('scheduled')));
            }
          } else if (idx === 0) {
            etaBox.appendChild(el('span', { class: 'small' }, t_str('loading')));
          } else {
            etaBox.appendChild(
              el('span', { class: 'small', style: 'color: var(--muted-2);' }, t_str('noEta'))
            );
          }
          row.appendChild(etaBox);
          list.appendChild(row);
        });
        body.replaceChildren(
          el('h2', { class: 'section-title' }, t_str('showingStop', stops.length)),
          list
        );
        if (targetRow) {
          requestAnimationFrame(() => {
            try {
              targetRow.scrollIntoView({ behavior: 'auto', block: 'center' });
            } catch {}
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
  //
  // Fare rendering precedence:
  //   1) `fareMin` / `fareMax` (when both are finite numbers from the
  //      per-stop fare fetch):
  //        - min == max → `車費 $X.X` (single value, just like before)
  //        - min <  max  → `車費 $X.X – $Y.Y` (range)
  //   2) Legacy `fare` (the head fare from the route index) — preserved
  //      when min/max are absent.
  //   3) Nothing — the header omits the fare line entirely.
  function buildRouteHeader(opts) {
    const {
      co,
      route,
      dir,
      service,
      dest,
      orig,
      origEn,
      dirLabel,
      fare,
      boundPills = [],
      servicePills = [],
      swapTarget = null,
      currentKey,
      currentDirKey,
      isMapRoute = false,
      fareMin,
      fareMax,
    } = opts;
    const head = el('div', { class: 'route-header' });

    // ---- top action bar ----
    const topbar = el('div', { class: 'route-topbar' });
    topbar.appendChild(
      el(
        'a',
        {
          class: 'route-back',
          'aria-label': t_str('back'),
          href: '#/',
        },
        (0,
        function () {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('width', '22');
          svg.setAttribute('height', '22');
          svg.setAttribute('aria-hidden', 'true');
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          p.setAttribute('fill', 'none');
          p.setAttribute('stroke', 'currentColor');
          p.setAttribute('stroke-width', '2');
          p.setAttribute('stroke-linecap', 'round');
          p.setAttribute('stroke-linejoin', 'round');
          p.setAttribute('d', 'M15 6l-6 6 6 6');
          svg.appendChild(p);
          return svg;
        })()
      )
    );

    const topRight = el('div', { class: 'route-topbar-right' });
    const langPill = el(
      'span',
      { class: 'route-lang-pill' },
      state.lang === 'zh-Hant' ? '繁體中文' : state.lang === 'zh-Hans' ? '简体中文' : 'English'
    );
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
      summary.appendChild(el('span', { class: 'route-op-pill' }, t_str(busetaUtils.opCoKey(co))));
    }
    head.appendChild(summary);

    // Destination (large title)
    if (dest) head.appendChild(el('h2', { class: 'route-dest' }, dest));

    // Origin · operator sub-line
    if (orig) {
      const sub = el('p', { class: 'route-sub' });
      const opName = t_str(busetaUtils.opCoKey(co));
      sub.appendChild(document.createTextNode(`${orig}${opName ? ' · ' + opName : ''}`));
      head.appendChild(sub);
    }

    // Fare (if available) — prefer the per-stop range (fareMin/fareMax) when
    // both are finite numbers, fall back to the legacy single `fare` from
    // the route index, otherwise omit the line entirely.
    if (Number.isFinite(fareMin) && Number.isFinite(fareMax)) {
      const fareText =
        fareMin === fareMax
          ? `${t_str('fare')} $${fmtFare(fareMin)}`
          : t_str('fareFullRange', fmtFare(fareMin), fmtFare(fareMax));
      head.appendChild(el('p', { class: 'route-fare' }, fareText));
    } else if (fare != null && fare !== '') {
      head.appendChild(el('p', { class: 'route-fare' }, `${t_str('fare')} ${fare}`));
    }

    // English subtitle
    if (origEn) head.appendChild(el('p', { class: 'route-sub-en' }, origEn));

    // ---- bound pills (outbound / inbound) — only when 2+ bounds exist ----
    // Each pill flips to a different bound while keeping service=1 (主線).
    if (Array.isArray(boundPills) && boundPills.length > 1) {
      const pills = el('div', { class: 'route-dir-pills', role: 'tablist' });
      for (const d of boundPills) {
        const isCurrent = d.dir === String(dir);
        const pill = el(
          'a',
          {
            class: `route-dir-pill ${isCurrent ? 'is-current' : ''}`,
            href: `#/route/${encodeURIComponent(d.co)}/${encodeURIComponent(d.route)}/${encodeURIComponent(d.dir)}/${encodeURIComponent(d.service)}`,
            role: 'tab',
            'aria-selected': String(isCurrent),
          },
          d.label
        );
        pills.appendChild(pill);
      }
      head.appendChild(pills);
    }

    // ---- in-place bound swap button ----
    // Rendered when the opposite bound exists for this route. Unlike the
    // bound pills above (which navigate via hash), this button re-renders
    // the current view with the opposite dir in-place — same route, same
    // service (falling back to service=1 when the opposite bound doesn't
    // carry the user's current service_type), no scroll jump, no flash of
    // search. Hidden for one-way routes (swapTarget === null) and for
    // non-bound pseudo-views (MTR LINE / STATION).
    if (swapTarget && swapTarget.co && swapTarget.dir) {
      const swapWrap = el('div', { class: 'bound-swap-row' });
      const swapBtn = el('button', {
        type: 'button',
        class: 'bound-swap-btn',
        'aria-label': t_str('boundSwapAria'),
        title: t_str('boundSwapHint'),
        onclick: (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          swapRouteBound();
        },
      });
      // ↔ glyph + label of the OPPOSITE direction (so the user knows what
      // they're flipping to — "↔ Inbound", "↔ 將軍澳", etc.). Falls back to
      // a direction word when the index doesn't carry a destination label.
      swapBtn.appendChild(boundSwapArrowSVG());
      const swapLabel = el('span', { class: 'bound-swap-label' }, swapTarget.label || '');
      swapBtn.appendChild(swapLabel);
      swapWrap.appendChild(swapBtn);
      head.appendChild(swapWrap);
    }

    // ---- service-type tabs (主線 / 特別班 2/3/4) within the current bound ----
    // justarrived-style: pills in a single row, active filled, others outlined.
    // Only render when the current bound has 2+ service-type variants.
    if (Array.isArray(servicePills) && servicePills.length > 1) {
      const tabs = el('div', { class: 'route-service-tabs', role: 'tablist' });
      for (const s of servicePills) {
        const isCurrent = String(s.service) === String(service);
        const tab = el(
          'a',
          {
            class: `route-service-tab ${isCurrent ? 'is-on' : ''}`,
            href: `#/route/${encodeURIComponent(s.co)}/${encodeURIComponent(s.route)}/${encodeURIComponent(s.dir)}/${encodeURIComponent(s.service)}`,
            role: 'tab',
            'aria-selected': String(isCurrent),
          },
          s.label
        );
        tabs.appendChild(tab);
      }
      head.appendChild(tabs);
    }

    // ---- update indicator + manual refresh ----
    const updated = el('div', { class: 'route-updated' });
    const updateLeft = el('div', { class: 'route-updated-left' });
    updateLeft.appendChild(
      el(
        'p',
        { class: 'route-updated-when', 'data-bind': 'route-updated-when' },
        t_str('updatedJust')
      )
    );
    updateLeft.appendChild(el('p', { class: 'route-updated-meta' }, t_str('updatedMeta')));
    // QW-8: countdown chip — counts down to the next auto-refresh.
    updateLeft.appendChild(
      buildRefreshProgress(state._nextRefreshAt || Date.now() + REFRESH_INTERVAL_MS)
    );
    updated.appendChild(updateLeft);

    const refreshBtn = el(
      'button',
      {
        type: 'button',
        class: 'route-refresh',
        'aria-label': t_str('refresh'),
        onclick: () => {
          if (typeof state._refreshRoute === 'function') state._refreshRoute();
          else location.reload();
        },
      },
      refreshIconSVG()
    );
    const shareBtn = el(
      'button',
      {
        type: 'button',
        class: 'share-btn route-share',
        'aria-label': t_str('shareLinkAria'),
        title: t_str('shareLink'),
        onclick: (ev) => {
          ev.stopPropagation();
          const url =
            location.origin +
            location.pathname +
            `#/route/${encodeURIComponent(co)}/${encodeURIComponent(route)}/${encodeURIComponent(dir)}/${encodeURIComponent(service)}`;
          copyShareLink(url, t_str('shareLinkAria'));
        },
      },
      shareIconSVG()
    );
    updated.appendChild(refreshBtn);
    updated.appendChild(shareBtn);
    head.appendChild(updated);

    return head;
  }

  // Filled / outline star SVG for the favorite toggle.
  function starIconSVG(filled) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute(
      'd',
      'M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.96l-5.9 3.1 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z'
    );
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
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    const a = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    a.setAttribute('d', 'M21 12a9 9 0 1 1-3.4-7.05');
    a.setAttribute('fill', 'none');
    a.setAttribute('stroke', 'currentColor');
    a.setAttribute('stroke-width', '2');
    a.setAttribute('stroke-linecap', 'round');
    svg.appendChild(a);
    const b = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    b.setAttribute('d', 'M21 4v5h-5');
    b.setAttribute('fill', 'none');
    b.setAttribute('stroke', 'currentColor');
    b.setAttribute('stroke-width', '2');
    b.setAttribute('stroke-linecap', 'round');
    b.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(b);
    return svg;
  }

  // ↔ swap-direction glyph for the bound-swap button. Horizontal arrow with
  // arrowheads on both ends (matches the "↔" glyph the brief asks for, but
  // vector so it scales cleanly and stays consistent across themes).
  function boundSwapArrowSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    const shaft = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shaft.setAttribute('d', 'M4 12h16');
    shaft.setAttribute('fill', 'none');
    shaft.setAttribute('stroke', 'currentColor');
    shaft.setAttribute('stroke-width', '1.8');
    shaft.setAttribute('stroke-linecap', 'round');
    svg.appendChild(shaft);
    const leftHead = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    leftHead.setAttribute('d', 'M8 8l-4 4 4 4');
    leftHead.setAttribute('fill', 'none');
    leftHead.setAttribute('stroke', 'currentColor');
    leftHead.setAttribute('stroke-width', '1.8');
    leftHead.setAttribute('stroke-linecap', 'round');
    leftHead.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(leftHead);
    const rightHead = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    rightHead.setAttribute('d', 'M16 8l4 4-4 4');
    rightHead.setAttribute('fill', 'none');
    rightHead.setAttribute('stroke', 'currentColor');
    rightHead.setAttribute('stroke-width', '1.8');
    rightHead.setAttribute('stroke-linecap', 'round');
    rightHead.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(rightHead);
    return svg;
  }

  // Flip the route view to its opposite bound, in-place. Looks up the
  // current route's swapTarget via buildDirectionPills (single source of
  // truth for what "opposite bound" means per operator), mutates
  // state.detailRoute / state.recent, and re-runs renderRoute() — which
  // dispatches to the right renderer (bus / LRT / GMB / MTR / etc.) using
  // the new dir. No-op when there's no opposite bound (one-way routes).
  function swapRouteBound() {
    const cur = state.detailRoute;
    if (!cur) return;
    const pills = buildDirectionPills(cur.co, cur.route, cur.dir, cur.service);
    const target = pills && pills.swapTarget;
    if (!target || !target.co) return;
    const newRoute = {
      co: target.co,
      route: target.route,
      dir: target.dir,
      service: target.service,
      // Preserve any stop-anchor / region hints carried on the current view.
      stopSeq: cur.stopSeq || null,
      _region: cur._region || undefined,
      _code: cur._code || undefined,
    };
    state.detailRoute = newRoute;
    // Refresh the recent-entries cache so the new direction surfaces in
    // 最近查過. pushRecent dedupes on (co, route, dir, service), so the
    // opposite-bound entry will sit at the top of the list while the
    // previous-bound entry drops down — same behaviour as a normal visit.
    pushRecent({
      co: newRoute.co,
      route: newRoute.route,
      dir: newRoute.dir,
      service: newRoute.service,
    });
    // Keep the URL bar in sync without triggering the hashchange handler
    // (which would otherwise cause a second renderRoute call).
    try {
      const newHash = `#/route/${encodeURIComponent(newRoute.co)}/${encodeURIComponent(newRoute.route)}/${encodeURIComponent(newRoute.dir)}/${encodeURIComponent(newRoute.service)}`;
      if (location.hash !== newHash && typeof history.replaceState === 'function') {
        history.replaceState(null, '', newHash);
      }
    } catch {}
    renderRoute(newRoute);
  }

  // Wire up the swipe-to-swap-bound gesture on the route view.
  // Behaviour:
  //   - swipe-left on the stop list → O → I / 1 → 2 / UP → DOWN
  //   - swipe-right on the stop list → I → O / 2 → 1 / DOWN → UP
  // The mapping follows the bound-swap convention (left = forward) and
  // is a no-op when the current dir doesn't have an opposite in the
  // index (one-way routes, MTR LINE / STATION pseudo-views).
  //
  // We listen on `document` (single delegation point) rather than per
  // render. The view is identified by #view-route being visible — if
  // it's hidden the swipe is silently ignored.
  function setupRouteSwipe() {
    if (typeof document === 'undefined') return;
    // State for the in-flight swipe. Module-scope is fine because only
    // one swipe can be active at a time and the route view is single-view.
    let tracking = false;
    let startX = 0;
    let startY = 0;
    const SWIPE_HORIZ_THRESHOLD = 70; // px — how far the user has to drag
    const SWIPE_VERT_LIMIT = 50; // px — max vertical drift allowed

    const shouldIgnore = (target) => {
      if (!target) return true;
      // Ignore touches that start on form / button elements anywhere
      // (the swap button, star, refresh, share, back, etc.) — those have
      // their own tap handlers and shouldn't double-trigger the swap.
      if (target.closest('button, input, select, textarea, label, [role="button"]')) return true;
      // Ignore touches that start on the route-header pills / tabs (bound
      // pills, service-type tabs) so the user can still tap them to
      // navigate without the swipe hijacking the gesture.
      if (target.closest('[data-bind="routeHeader"] [role="tab"]')) return true;
      return false;
    };

    document.addEventListener(
      'touchstart',
      (e) => {
        const view = document.getElementById('view-route');
        if (!view || view.hidden) {
          tracking = false;
          return;
        }
        if (shouldIgnore(e.target)) {
          tracking = false;
          return;
        }
        if (!e.touches || e.touches.length !== 1) {
          tracking = false;
          return;
        }
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        tracking = true;
      },
      { passive: true }
    );

    document.addEventListener(
      'touchcancel',
      () => {
        tracking = false;
      },
      { passive: true }
    );

    document.addEventListener(
      'touchend',
      (e) => {
        if (!tracking) return;
        tracking = false;
        const view = document.getElementById('view-route');
        if (!view || view.hidden) return;
        const touches = e.changedTouches;
        if (!touches || touches.length === 0) return;
        const t = touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dy) > SWIPE_VERT_LIMIT) return; // vertical scroll — ignore
        if (Math.abs(dx) < SWIPE_HORIZ_THRESHOLD) return; // too short
        const cur = state.detailRoute;
        if (!cur) return;
        // Direction-keyed gating: left = forward, right = backward.
        // Skip the gesture when the user swiped the wrong way for their
        // current bound (e.g. already on I, swiping left).
        const OPPOSITE = { O: 'I', I: 'O', 1: '2', 2: '1', UP: 'DOWN', DOWN: 'UP' };
        const curDir = String(cur.dir);
        if (!OPPOSITE[curDir]) return; // one-way or pseudo view
        const goingLeft = dx < 0;
        const isForwardDir = curDir === 'O' || curDir === '1' || curDir === 'UP';
        if (goingLeft && !isForwardDir) return;
        if (!goingLeft && isForwardDir) return;
        swapRouteBound();
      },
      { passive: true }
    );
  }

  // Build the list of direction pills for a route header. Scans the index
  // Returns three pieces for the route header:
  //   - boundPills:    [{co, route, dir, service, label, key}]
  //                    one entry per bound (uses service=1 as the canonical
  //                    destination for that bound, so user can flip bound)
  //   - servicePills:  [{co, route, dir, service, label, key}]
  //                    all service-type variants of the CURRENT bound —
  //                    labeled "主線" / "Main" for service=1 and
  //                    "特別班 N" / "Special N" for service=2..9.
  //   - swapTarget:    a single pill-shaped entry pointing at the route with
  //                    the OPPOSITE bound, if such a route exists in the
  //                    index. `null` for one-way routes (e.g. MTR line /
  //                    station) or when the user is already on the only
  //                    bound. Used by the in-place bound-swap button so the
  //                    user can flip O ↔ I without going back to search.
  // We scan the operator's routes map (KMB / LWB / CTB / NWFB / GMB / LRT) for
  // every (co, route) variant. The caller decides which set to render:
  //   boundPills    → only if >1 bound exists
  //   servicePills  → only if >1 service_type exists for the current bound
  //   swapTarget    → only if a valid opposite bound exists
  // This mirrors justarrived's 主線 / 特別班 2 / 特別班 3 / 特別班 4 row.
  function buildDirectionPills(co, route, currentDir, currentService) {
    const all = [];
    const add = (entry) => {
      if (!entry) return;
      const dKey = String(entry.dir);
      const sKey = String(entry.service);
      const key = `${entry.co}|${entry.route}|${dKey}|${sKey}`;
      const label = pickFirst(entry.destTc, entry.destEn) || entry.origTc || '';
      all.push({
        co: entry.co,
        route: entry.route,
        dir: dKey,
        service: sKey,
        label,
        key,
        destTc: entry.destTc || '',
        destEn: entry.destEn || '',
      });
    };

    if (state.index) {
      const tryMap = (map) => {
        if (!map) return;
        map.forEach((entry) => {
          if (entry.co !== co) return;
          if (String(entry.route) !== String(route)) return;
          add(entry);
        });
      };
      tryMap(state.index.routes);
      tryMap(state.index.ctbRoutes);
      if (state.index.lrt && state.index.lrt.routes) tryMap(state.index.lrt.routes);
    }

    // boundPills: dedupe by dir, prefer the regular service (1) as the
    // canonical row so the bound flip lands the user on the main line.
    const boundMap = new Map();
    all.forEach((e) => {
      const k = `${e.co}|${e.route}|${e.dir}`;
      const existing = boundMap.get(k);
      if (!existing || (e.service === '1' && existing.service !== '1')) {
        boundMap.set(k, e);
      }
    });
    const boundPills = Array.from(boundMap.values());

    // servicePills: filter to current bound, dedupe by service, label by
    // service_type (主線/特別班 N) rather than destination.
    const servicePills = all
      .filter((e) => e.dir === String(currentDir))
      .reduce((acc, e) => {
        if (!acc.has(e.service)) acc.set(e.service, e);
        return acc;
      }, new Map());
    const serviceList = Array.from(servicePills.values()).sort((a, b) => {
      // service=1 first (主線), then 2, 3, 4… numerically
      return Number(a.service) - Number(b.service);
    });
    serviceList.forEach((e) => {
      const n = Number(e.service);
      e.label = n === 1 ? t_str('serviceMain') : t_str('serviceSpecialN', n);
    });

    // swapTarget: a pill-shaped entry pointing at the OPPOSITE bound. The
    // dispatch here covers the operators that use a binary bound code:
    //   O ↔ I  → KMB / LWB / CTB / NWFB / GMB
    //   1 ↔ 2  → LRT (上行 / 下行)
    //   UP ↔ DOWN → kept for completeness, though no current caller uses it
    // For non-binary dir codes (MTR 'LINE', 'STATION', etc.) the swap is
    // meaningless and we return null so the button stays hidden.
    const OPPOSITE = { O: 'I', I: 'O', 1: '2', 2: '1', UP: 'DOWN', DOWN: 'UP' };
    const cur = String(currentDir);
    const opp = OPPOSITE[cur];
    let swapTarget = null;
    if (opp) {
      // Prefer the same service_type as the current view so the swap keeps
      // the user on, e.g., 特別班 3 in both directions. Fall back to the
      // canonical service=1 (主線) if the opposite bound doesn't have that
      // service_type — matches the bound-pill click behaviour.
      const curSvc = String(currentService);
      const candidate =
        all.find((e) => e.dir === opp && e.service === curSvc) ||
        all.find((e) => e.dir === opp && e.service === '1') ||
        all.find((e) => e.dir === opp);
      if (candidate) {
        swapTarget = {
          co: candidate.co,
          route: candidate.route,
          dir: candidate.dir,
          service: candidate.service,
          // Use the destination label so the button reads "↔ 將軍澳"
          // rather than the bare direction word. Falls back to the bound
          // direction's i18n label (Inbound / Outbound) when we don't have
          // a destination — the user still sees what they're swapping to.
          label:
            pickFirst(candidate.destTc, candidate.destEn) ||
            (candidate.dir === 'I' ? t_str('inbound') : t_str('outbound')),
          key: candidate.key,
        };
      }
    }

    return { boundPills, servicePills: serviceList, swapTarget };
  }

  function toggleSaveRoute(r) {
    const i = state.savedRoutes.findIndex((x) => sameRoute(x, r));
    if (i >= 0) {
      state.savedRoutes.splice(i, 1);
      toast(t_str('unsave'));
    } else {
      state.savedRoutes.push(r);
      toast(t_str('saved'));
    }
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

    const fetcher = isCtb ? () => fetchCitybusBatchStopEta(stopId) : () => fetchKmbStopEta(stopId);

    const promise = fetcher()
      .then((resp) => {
        const data = resp && Array.isArray(resp.data) ? resp.data : [];
        // Normalize rows from both operators into a single shape:
        // { co, route, dir, service, destTc, destEn, time (Date), seq }
        const rows = [];
        for (const e of data) {
          if (!e || !e.eta) continue; // skip null ETAs (route not running today)
          const t = new Date(e.eta);
          if (Number.isNaN(t.getTime())) continue;
          const co = isCtb ? 'CTB' : busetaUtils.classifyKmbOp(e.route, '', e.dest_tc || '');
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
  function buildStopTabs(stopId, isCtb, fetchStopId) {
    const isLive = state._stopViewMode !== 'schedule';
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
        // v36: schedule fetch uses the resolved internal 16-hex ID so
        // operator-facing codes (e.g. "MA973") don't 404 upstream.
        renderSchedulePanel(schedulePanel, fetchStopId || stopId, isCtb);
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
    // If the schedule is already cached and the panel was just freshly
    // built, skip the loading spinner entirely — paint straight from cache.
    const cacheKey = `${isCtb ? 'CTB' : 'KMB'}|${stopId}`;
    const cached = scheduleCache.get(cacheKey);
    if (cached) {
      panel.innerHTML = '';
      paintScheduleRows(panel, cached);
      return;
    }

    panel.innerHTML = '';
    panel.appendChild(
      el(
        'p',
        { class: 'muted', style: 'text-align:center; padding: 24px 8px;' },
        t_str('loadingSchedule')
      )
    );

    fetchStopSchedule(stopId, isCtb).then((rows) => {
      panel.innerHTML = '';
      paintScheduleRows(panel, rows);
    });
  }

  function paintScheduleRows(panel, rows) {
    panel.appendChild(
      el('p', { class: 'muted', style: 'margin-top: 4px; font-size: 12px;' }, t_str('scheduleNote'))
    );

    if (!rows.length) {
      panel.appendChild(
        el('p', { class: 'empty', style: 'margin-top: 12px;' }, t_str('scheduleEmpty'))
      );
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
      const bucket = el('section', {
        class: 'stop-schedule-bucket',
        'aria-label': t_str('scheduleHour', h),
      });
      bucket.appendChild(el('h3', { class: 'stop-schedule-hour' }, t_str('scheduleHour', h)));
      const ul = el('ul', { class: 'stop-schedule-rows' });
      byHour.get(h).forEach((r) => {
        const destStr = pickFirst(r.destTc, r.destEn);
        const li = el('li', { class: 'stop-schedule-row' });
        li.appendChild(el('span', { class: 'stop-schedule-route' }, r.route));
        li.appendChild(
          el('span', { class: 'stop-schedule-time' }, formatHMTimestamp(r.time.toISOString()))
        );
        if (destStr) li.appendChild(el('span', { class: 'stop-schedule-dest' }, destStr));
        li.appendChild(el('span', { class: 'stop-schedule-op' }, t_str(busetaUtils.opCoKey(r.co))));
        ul.appendChild(li);
      });
      bucket.appendChild(ul);
      list.appendChild(bucket);
    }
    panel.appendChild(list);
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

    // QW-1: Seed the header from the local stop index *synchronously* so
    // the user never sees the raw 16-hex ID (e.g. "0C81107C4ABFCD7C") as
    // the heading while waiting for the upstream fetch. If the local index
    // doesn't have this stop we still render with the ID, but only as a
    // last-resort fallback — and we re-render below the moment the fetch
    // resolves.
    //
    // v34: when BOTH the local-index lookup AND the operator-ID reverse
    // map miss, the seed falls back to t_str('stopUnknownName') instead
    // of the raw ID. The raw ID is still surfaced as a muted paragraph
    // (see buildStopHeader's stopUnknown branch) so the user can debug.
    let seedNameTc = stopId;
    let seedNameEn = '';
    let seedNameSc = '';
    let seedUnknown = false;
    // v36 · When the user navigates via a KMB operator-facing code (e.g.
    // "#/stop/MA973"), the seed lookup falls through to `kmbOperatorId`
    // and we capture the corresponding internal 16-hex ID (e.g.
    // "0C81107C4ABFCD56") so subsequent ETA + schedule fetches go to
    // upstream using the ID it actually understands. Without this, the
    // heading resolves but the live panel always falls through to the
    // empty state because KMB upstream rejects operator codes.
    let seedInternalStopId = stopId;
    if (state.index && state.index.stops) {
      const idxMeta = state.index.stops.get(stopId);
      if (idxMeta) {
        seedNameTc = idxMeta.nameTc || seedNameTc;
        seedNameEn = idxMeta.nameEn || seedNameEn;
        seedNameSc = idxMeta.nameSc || seedNameSc;
      } else if (!isCtb && state.index.kmbOperatorId) {
        const opMeta = state.index.kmbOperatorId.get(stopId);
        if (opMeta) {
          seedNameTc = opMeta.nameTc || seedNameTc;
          seedNameEn = opMeta.nameEn || seedNameEn;
          seedNameSc = opMeta.nameSc || seedNameSc;
          if (opMeta.internalId) seedInternalStopId = opMeta.internalId;
        } else {
          seedUnknown = true;
        }
      } else {
        seedUnknown = true;
      }
    } else {
      seedUnknown = true;
    }
    if (seedUnknown) seedNameTc = t_str('stopUnknownName');
    header.appendChild(
      buildStopHeader(stopId, seedNameTc, seedNameEn, opGuess, seedNameSc, seedUnknown)
    );

    // Stop view mode lives on the bus-stop view only. Default to 'live'
    // every time the user opens a new stop so they get the familiar arrival
    // board first; they can opt into the Schedule tab from there.
    state._stopViewMode = 'live';
    // v34: tracks whether the current stop is unresolvable so refreshBusStopView
    // can re-append the back-to-home CTA after its body-wipe on every refresh.
    state._currentStopUnknown = seedUnknown;

    // Tab control + per-tab panels. Live panel keeps the existing
    // body element so the current rendering logic still works.
    const tabs = buildStopTabs(stopId, isCtb, seedInternalStopId);
    const livePanel = tabs.livePanel;
    // QW-2: skeleton placeholders replace the bare "載入緊資料…" text.
    livePanel.appendChild(buildSkeletonList(4));
    tabs.schedulePanel.appendChild(
      el(
        'p',
        { class: 'muted', style: 'text-align:center; padding: 24px 8px;' },
        t_str('loadingSchedule')
      )
    );

    body.appendChild(tabs.tablist);
    body.appendChild(livePanel);
    body.appendChild(tabs.schedulePanel);

    const stopPromise = isCtb
      ? fetchCitybusStop(stopId).catch(() => null)
      : fetchKmbStop(stopId).catch(() => null);

    const stateRef = {
      panel: livePanel,
      header,
      stopId,
      internalStopId: seedInternalStopId,
      view,
      schedulePanel: tabs.schedulePanel,
      switchTo: tabs.switchTo,
    };
    state._refreshStop = (opts) => {
      const mode = (opts && opts.mode) || 'live';
      if (mode === 'schedule' && stateRef.schedulePanel) {
        // Bypass the cache and force a re-fetch of the timetable, then
        // re-render the schedule panel. v36: use the resolved internal
        // 16-hex ID so the schedule fetch goes to upstream with the ID
        // it understands (operator-facing codes like "MA973" 404 upstream).
        const schedFetchStopId = stateRef.internalStopId || stopId;
        scheduleCache.delete(`${isCtb ? 'CTB' : 'KMB'}|${schedFetchStopId}`);
        renderSchedulePanel(stateRef.schedulePanel, schedFetchStopId, isCtb);
        return;
      }
      refreshBusStopView(stateRef, mode);
    };

    stopPromise.then((stopResp) => {
      let nameTc = stopId,
        nameSc = '',
        nameEn = '';
      let stop = null;
      let upstreamResolved = false;
      if (stopResp && stopResp.data) {
        stop = stopResp.data;
        if (Array.isArray(stop)) stop = stop[0];
        if (stop && (stop.name_tc || stop.name_en)) {
          nameTc = stop.name_tc || nameTc;
          nameSc = stop.name_sc || '';
          nameEn = stop.name_en || '';
          upstreamResolved = true;
        }
      }
      // Fall back to the local index (hk-stops.json) for both names and lat/lng.
      const idxMeta = state.index.stops.get(stopId);
      if (idxMeta) {
        nameTc = pickFirst(idxMeta.nameTc, nameTc) || nameTc;
        nameSc = pickFirst(idxMeta.nameSc, nameSc) || nameSc;
        nameEn = pickFirst(idxMeta.nameEn, nameEn) || nameEn;
      } else if (!isCtb && state.index.kmbOperatorId) {
        // KMB's open-data feeds use 16-hex internal IDs; the operator-facing
        // code on the bus stop sign (e.g. "ST905") only appears as a
        // "(ST905)" suffix on each stop's name. Direct navigation to
        // `#/stop/ST905` reaches us with an ID the upstream can't resolve —
        // fall back to the reverse map built at index time.
        const opMeta = state.index.kmbOperatorId.get(stopId);
        if (opMeta) {
          nameTc = opMeta.nameTc || nameTc;
          nameSc = opMeta.nameSc || nameSc;
          nameEn = opMeta.nameEn || nameEn;
        }
      }
      // v34: if upstream, the local index, AND the operator-ID reverse map
      // all missed, the stop is unresolvable. Drop the raw ID from the
      // heading, surface t_str('stopUnknownName'), append a "Back to home"
      // CTA so the user has somewhere to go, and prune any poisoned recent
      // entries (e.g. a stale 16-hex ID carried over from an old session).
      const opMap = state.index && state.index.kmbOperatorId;
      const stopUnknown = !upstreamResolved && !idxMeta && !(opMap && opMap.get(stopId));
      if (stopUnknown) {
        nameTc = t_str('stopUnknownName');
        nameSc = '';
        nameEn = '';
        state._currentStopUnknown = true;
        pruneRecentStops();
        appendStopUnknownCTA(livePanel, stopId);
      } else {
        state._currentStopUnknown = false;
      }
      header.replaceChildren(
        ...buildStopHeader(stopId, nameTc, nameEn, opGuess, nameSc, stopUnknown).childNodes
      );
      state._lastStopName = nameFor({ nameTc, nameSc, nameEn });
      state._lastStopNameEn = nameEn;
      // Cache the resolved name on the recent entry so 最近查過 shows the
      // real stop name on the home page instead of just the operator ID.
      // Skip for unresolvable stops — we'd just be re-poisoning the list.
      if (!stopUnknown) enrichRecentStop(stopId, nameTc, nameSc, nameEn);
    });

    refreshBusStopView(stateRef, 'live');
    startEtaRefresh(renderStopDetail);
  }

  // v37: terminus-style match against the local route index.
  //
  // KMB's `/stop-eta` (and CTB's `/batch/stop-eta/CTB/{stop}`) endpoints
  // only return rows for routes with an imminent bus. Off-peak routes
  // that serve the same stop don't appear in the live panel — e.g. at
  // 利安巴士總站 (MA973) the upstream returns only 680 + 87K at 11:31 AM
  // even though 86C / 87P / 286C also terminate there. Approximate the
  // missing route set by walking `state.index.routes` and matching routes
  // whose origTc OR destTc equals the resolved stop name (TC, exact match
  // after stripping operator-suffix artefacts). Returns an array of route
  // descriptors shaped like the entries inserted into the `routeMap`
  // downstream (co, route, dir, service, origTc, origEn, destTc, destEn).
  //
  // Excludes GMB / LRT / MTR — those operators enumerate stops per-route
  // rather than at bus-stop level, and their routes never terminate at
  // a KMB-style 巴士總站. Exact match (not substring) so 利安 matches 利安
  // but NOT 利安山.
  //
  // NOTE: the term "routesByStop" now lives in `src/utils/routes-by-stop.js`
  // (added in v53 / Phase 11) and is populated by `prefetchRouteStops()`
  // (Phase 12) which queries `/route-stop/{route}/{dir}/{service}` for every
  // route, so via-stops now show up in the live panel via
  // `findRoutesServingStop({ routesByStop, terminusMatches })`. This
  // function only fills the `terminusMatches` half — it's intentionally
  // kept as a fast terminus-only scan that works even when the
  // /route-stop prefetch hasn't completed.
  function findTerminusRoutesForStop(stopNameTc) {
    const want = busetaUtils.stripKmbOpSuffix(stopNameTc);
    if (!want) return [];
    const matches = [];
    state.index.routes.forEach((r) => {
      // GMB / LRT / MTR are kept out of state.index.routes for KMB/LWB/CTB,
      // but GMB routes live there too — filter explicitly so a GMB route
      // whose orig/dest happens to match the stop name never leaks into
      // the live panel of a KMB bus stop.
      if (r.co !== 'KMB' && r.co !== 'LWB' && r.co !== 'CTB' && r.co !== 'NWFB') return;
      const o = busetaUtils.stripKmbOpSuffix(r.origTc || '');
      const d = busetaUtils.stripKmbOpSuffix(r.destTc || '');
      if (o !== want && d !== want) return;
      matches.push({
        co: r.co,
        route: r.route,
        dir: r.dir,
        service: r.service,
        origTc: r.origTc,
        origEn: r.origEn,
        destTc: r.destTc,
        destEn: r.destEn,
      });
    });
    return matches;
  }

  // Fetch the latest ETAs for the current bus stop and re-render the body.
  // `mode` lets callers force a re-render of the live panel even when the
  // user is currently looking at the Schedule tab (used when switching back
  // to live so the board always shows fresh data).
  //
  // v35: now iterates over ALL entries returned by the upstream /stop-eta
  // (KMB) / /batch/stop-eta/CTB/{stop} (CTB) feeds — including rows where
  // `eta === null` — and renders a dimmed `.route-card--no-eta` placeholder
  // for every (co, route, dir, service, dest) group that currently has no
  // upcoming arrival. That fixes the long-standing UX bug where off-peak
  // stops (where most routes are not running) only showed a single route.
  //
  // v37: after the upstream-driven groupBy completes, augments the
  // `routeMap` with terminus-style matches from the local route index so
  // off-peak routes still show up as dimmed `.route-card--no-eta`
  // placeholders. Existing live-ETA cards are unaffected — the existing
  // groupBy runs first, and the terminus scan only inserts entries that
  // aren't already present.
  function refreshBusStopView(stateRef, mode) {
    if (!stateRef || !stateRef.panel) return;
    if (mode === 'schedule') return; // Schedule owns its own render path.
    // v36 · Use the resolved internal 16-hex ID for upstream calls when
    // the user navigated via a KMB operator-facing code (e.g. MA973).
    // `internalStopId` falls back to `stopId` for stops reached by their
    // 16-hex directly (the common case).
    const { stopId, internalStopId, panel: body, switchTo } = stateRef;
    const fetchStopId = internalStopId || stopId;

    // Body only — never wipe the header.
    body.innerHTML = '';
    // QW-2: skeleton placeholders replace the bare "載入緊資料…" text.
    body.appendChild(buildSkeletonList(4));

    const isCtb = typeof fetchStopId === 'string' && /^[0-9]{6}$/.test(fetchStopId);
    // v35: enable the live fetch for CTB too — previously the CTB live
    // panel always fell through to the empty state because etaPromise was
    // hardcoded to null. Both operators now flow through the same groupBy
    // path; the batch endpoint shape (route, dir, service_type, eta,
    // dest_tc, dest_en, seq) is close enough to KMB's /stop-eta response
    // that the same loop handles both. CTB's operator id is hardcoded
    // since classifyKmbOp is KMB-only.
    const etaPromise = isCtb
      ? fetchCitybusBatchStopEta(fetchStopId).catch(() => null)
      : fetchKmbStopEta(fetchStopId).catch(() => null);

    Promise.resolve(etaPromise).then((etaResp) => {
      const data = etaResp && Array.isArray(etaResp.data) ? etaResp.data : [];

      // Map element (bottom): only when we have lat/lng.
      const mapEl = (() => {
        const meta = state.index.stops.get(fetchStopId) || state.index.stops.get(stopId);
        if (!meta || !Number.isFinite(meta.lat) || !Number.isFinite(meta.lng)) return null;
        const m = renderStopMap(meta.lat, meta.lng, nameFor(meta) || stopId);
        return m.firstChild ? m : null;
      })();

      body.innerHTML = '';

      if (data.length === 0) {
        // QW-5: rich empty state with CTAs. Triggered when the upstream
        // returned *zero* entries (literal "no routes serve this stop").
        // The new no-ETA placeholder path below handles the different
        // case where the upstream returned entries but every one of them
        // had `eta === null` — i.e. routes exist but no bus is running
        // right now — so this branch keeps its original semantics.
        const emptyState = buildStopEmptyState({
          onSchedule: switchTo ? () => switchTo('schedule') : null,
          onRetry: () => {
            if (typeof state._refreshStop === 'function') state._refreshStop({ mode: 'live' });
          },
        });
        body.appendChild(emptyState);
        if (isCtb) {
          const hint = el('p', { class: 'muted', style: 'margin-top: 4px;' });
          hint.appendChild(document.createTextNode(t_str('ctbNoEtaHint') || ''));
          body.appendChild(hint);
        }
        // v34: if renderBusStopView flagged the stop as unresolvable,
        // append the back-to-home CTA so the user has somewhere to go
        // after every refresh (refreshBusStopView wipes the body).
        if (state._currentStopUnknown) appendStopUnknownCTA(body, stopId);
        if (mapEl) body.appendChild(mapEl);
        return;
      }

      // Group arrivals by (co, route, dir, service, dest). Keep up to 3 ETAs
      // per group sorted by time. Just like justarrived.grok.me: one card
      // per route, primary arrival big + 2 more as secondary text.
      //
      // v35: iterate over every entry — not just the ones with a non-null
      // ETA. Groups that ended up with zero non-null ETAs are rendered as
      // a dimmed `.route-card--no-eta` placeholder further down.
      const routeMap = new Map();
      for (const e of data) {
        const co = isCtb ? 'CTB' : busetaUtils.classifyKmbOp(e.route, '', e.dest_tc || '');
        const key = `${co}|${e.route}|${e.dir}|${e.service_type}|${e.dest_tc || ''}`;
        if (!routeMap.has(key)) {
          routeMap.set(key, {
            co,
            route: e.route,
            dir: e.dir,
            service: e.service_type,
            destTc: e.dest_tc,
            destEn: e.dest_en,
            seq: e.seq,
            arrivals: [],
          });
        }
        if (e.eta) {
          routeMap.get(key).arrivals.push({
            eta: e.eta,
            minutes: minutesUntil(e.eta),
            rmk: e.rmk_en,
          });
        }
      }

      // v37: augment the upstream-driven route set with terminus-style
      // matches from the local route index. KMB's /stop-eta (and CTB's
      // /batch/stop-eta) only return rows for routes with an imminent
      // bus, so off-peak routes that serve the same stop never appear.
      // Approximate the missing route set by matching routes whose
      // origTc / destTc equals the resolved stop name. Live-ETA cards
      // are unaffected — the existing groupBy above already populated
      // `routeMap` with everything upstream returned, and the terminus
      // scan only inserts entries that aren't already present.
      //
      // Prefer the resolved TC name written by `renderBusStopView`
      // (`state._lastStopName` is `nameFor(...)` in the current UI
      // language — for zh-Hant it's TC, which is what we need to match
      // against route origTc/destTc). Fall back to the local-index
      // stop metadata if the metadata enrichment hasn't completed yet
      // (the upstream ETA fetch can resolve before the metadata fetch
      // on a cold load). If both are empty, skip the scan entirely so
      // we don't add false positives — terminus matching without a
      // resolved stop name would match every route in the index whose
      // orig/dest happens to be empty.
      const resolvedStopTc = (() => {
        const fromState = state._lastStopName && String(state._lastStopName).trim();
        if (fromState) return fromState;
        const meta = state.index.stops.get(fetchStopId) || state.index.stops.get(stopId);
        return meta ? String(meta.nameTc || '').trim() : '';
      })();
      if (resolvedStopTc) {
        // Merge via-stops (state.routesByStop, populated from upstream
        // /route-stop data) with the legacy terminus scan. The via-stops
        // map is empty until the prefetcher has had a chance to run, so
        // the terminus scan still serves as a graceful fallback for the
        // first visit (or any operator whose /route-stop fetch failed).
        // v53: helper lives in src/utils/routes-by-stop.js (Phase 11).
        const matches = busetaUtils.findRoutesServingStop(resolvedStopTc, {
          routesByStop: state.routesByStop,
          terminusMatches: findTerminusRoutesForStop(resolvedStopTc),
        });
        for (const t of matches) {
          const key = `${t.co}|${t.route}|${t.dir}|${t.service}|${t.destTc || ''}`;
          if (routeMap.has(key)) continue;
          routeMap.set(key, {
            co: t.co,
            route: t.route,
            dir: t.dir,
            service: t.service,
            destTc: t.destTc,
            destEn: t.destEn,
            // Terminus scan has no upstream seq; leave null so the
            // route-detail anchor falls back to the route's first stop.
            seq: null,
            arrivals: [],
          });
        }
      }

      routeMap.forEach((r) => {
        r.arrivals.sort((a, b) => (a.minutes ?? 9999) - (b.minutes ?? 9999));
        // Trim the primary arrival's stop seq for the route-detail anchor.
        if (r.seq == null && r.arrivals.length > 0) {
          // KMB /stop-eta carries an explicit seq; nothing to backfill here.
        }
      });

      // v35: sort so live-ETA groups come first (by primary arrival time),
      // then no-ETA placeholder groups sorted alphabetically by route
      // number. `localeCompare(..., { numeric: true })` keeps "1, 2, 10"
      // in human order rather than lex order.
      const routes = Array.from(routeMap.values()).sort((a, b) => {
        const aHas = a.arrivals.length > 0;
        const bHas = b.arrivals.length > 0;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (aHas && bHas) {
          const aMin = a.arrivals[0]?.minutes ?? 9999;
          const bMin = b.arrivals[0]?.minutes ?? 9999;
          return aMin - bMin;
        }
        return String(a.route).localeCompare(String(b.route), undefined, { numeric: true });
      });

      body.appendChild(el('h2', { class: 'section-title' }, t_str('nextArrivals')));
      // a11y (Phase 16): a visually-hidden live region under the heading
      // gets the summary string written into it after each refresh, so
      // screen-reader users hear "X buses, soonest in N minutes" without
      // every eta-card re-firing the announcement. `aria-atomic="true"`
      // so the whole string is read each time it changes.
      const liveRegion = el('div', {
        class: 'sr-only',
        'aria-live': 'polite',
        'aria-atomic': 'true',
        role: 'status',
      });
      body.appendChild(liveRegion);
      const liveLast = { text: '' };
      const list = el('div', { class: 'arrival-list' });

      routes.forEach((r) => {
        if (r.arrivals.length === 0) {
          // v35: route serves this stop but has no upcoming bus in the
          // upstream horizon. Render the dimmed placeholder card so the
          // user can still see the route; the "View schedule" CTA flips
          // them to the Schedule tab where the timetable preview lives.
          list.appendChild(
            buildNoEtaCard(
              r.co,
              r.route,
              r.destTc,
              r.destEn,
              switchTo ? () => switchTo('schedule') : null
            )
          );
          return;
        }

        const anchor = r.seq != null ? `/${encodeURIComponent(String(r.seq))}` : '';
        const href = `#/route/${encodeURIComponent(r.co)}/${encodeURIComponent(r.route)}/${encodeURIComponent(r.dir)}/${encodeURIComponent(r.service)}${anchor}`;
        const card = el('a', { class: 'arrival-card', href });

        // ---- left: route number + operator pill + destination + fare ----
        const left = el('div', { class: 'arrival-card-left' });
        left.appendChild(el('div', { class: 'arrival-card-route' }, r.route));
        const meta = el('div', { class: 'arrival-card-meta' });
        meta.appendChild(
          el('span', { class: 'arrival-card-op' }, t_str(busetaUtils.opCoKey(r.co)))
        );
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
            const isNow = a.minutes == null || a.minutes <= 0;
            if (isNow) pcls.push('is-now');
            const primary = el('div', { class: pcls.join(' ') });
            if (isNow) {
              primary.appendChild(el('span', { class: 'arrival-card-now' }, t_str('arriving')));
            } else {
              primary.appendChild(el('span', { class: 'arrival-card-mins' }, String(a.minutes)));
              primary.appendChild(document.createTextNode(' ' + t_str('minShort')));
            }
            primary.appendChild(
              el('span', { class: 'arrival-card-clock' }, formatHMTimestamp(a.eta))
            );
            right.appendChild(primary);
          } else {
            const sec = el('div', { class: 'arrival-card-secondary' });
            sec.appendChild(
              document.createTextNode(
                `${a.minutes} ${t_str('minShort')} · ${formatHMTimestamp(a.eta)}`
              )
            );
            if (a.rmk === 'Last Bus')
              sec.appendChild(
                el('span', { class: 'arrival-card-tag' }, t_str('lastBus') || 'Last')
              );
            right.appendChild(sec);
          }
        });
        card.appendChild(right);
        list.appendChild(card);
      });

      // a11y (Phase 16): write a one-shot summary into the live region
      // after every refresh so screen-reader users hear how many buses
      // are arriving soon without each `eta-card` change re-firing. We
      // only update the textContent when the summary actually changes
      // to avoid the screen reader announcing the same thing twice.
      const next = busetaUtils.buildStopViewSummary(busetaUtils.summariseSoon(routes), t_str);
      if (next !== liveLast.text) {
        liveRegion.textContent = next;
        liveLast.text = next;
      }

      body.appendChild(list);
      if (mapEl) body.appendChild(mapEl);
    });
  }

  // v35: render a dimmed "no upcoming bus" placeholder card for routes
  // that serve the stop but currently have no ETA in the upstream horizon.
  // The card reuses the same operator pill + route number + destination
  // layout as the live arrival card so the user can read each row at a
  // glance; only the right column dims and the "View schedule" CTA replaces
  // the ETA stack.
  //
  // Signature:
  //   buildNoEtaCard(co, route, destTc, destEn, onSchedule)
  //     co         - operator id ("KMB", "CTB", …) used to pick the pill
  //                  label via t_str(busetaUtils.opCoKey(co)).
  //     route      - route number string ("1A", "KMB 970", …).
  //     destTc     - Traditional-Chinese destination (may be '').
  //     destEn     - English destination (may be '').
  //     onSchedule - optional callback invoked when the "View schedule"
  //                  pill is tapped. Pass `() => switchTo('schedule')` so
  // the user lands on the Schedule tab.
  function buildNoEtaCard(co, route, destTc, destEn, onSchedule) {
    const card = el('div', { class: 'route-card route-card--no-eta' });

    // ---- left: operator pill + route number + destination (TC + EN) ----
    const left = el('div', { class: 'route-card-left' });
    const head = el('div', { class: 'route-card-head' });
    head.appendChild(el('span', { class: 'route-card-op' }, t_str(busetaUtils.opCoKey(co))));
    head.appendChild(el('span', { class: 'route-card-num' }, route));
    left.appendChild(head);

    const meta = el('div', { class: 'route-card-meta' });
    const destStr = pickFirst(destTc, destEn);
    if (destStr) meta.appendChild(el('span', { class: 'route-card-dest' }, `往 ${destStr}`));
    if (destEn && destEn !== destStr) {
      meta.appendChild(el('span', { class: 'route-card-dest-en' }, destEn));
    }
    left.appendChild(meta);
    card.appendChild(left);

    // ---- right: muted "暫無到站時間" + hint + "View schedule" link ----
    const right = el('div', { class: 'route-card-right' });
    const label = el(
      'div',
      {
        class: 'route-card-mins stop-no-upcoming-eta',
      },
      t_str('stopNoUpcomingEta')
    );
    const hint = el(
      'div',
      {
        class: 'stop-no-upcoming-eta-hint',
      },
      t_str('stopNoUpcomingEtaHint')
    );
    right.appendChild(label);
    right.appendChild(hint);
    if (typeof onSchedule === 'function') {
      const cta = el('button', {
        type: 'button',
        class: 'route-card-no-eta-link stop-no-upcoming-eta-cta',
        'aria-label': t_str('stopNoUpcomingEtaCta'),
      });
      cta.appendChild(document.createTextNode(t_str('stopNoUpcomingEtaCta')));
      cta.appendChild(document.createTextNode(' ›'));
      cta.addEventListener('click', (ev) => {
        ev.preventDefault();
        try {
          onSchedule();
        } catch (_) {
          /* swallow: schedule panel may be missing */
        }
      });
      right.appendChild(cta);
    }
    card.appendChild(right);

    return card;
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
    // v34: when the LRT stop lookup misses, fall back to a friendly name
    // + the raw ID sub-line instead of dumping the operator code as the
    // heading. Prune any poisoned recent entry as well.
    const stopUnknown = !stop;
    const nameTc = stop ? stop.nameTc : t_str('stopUnknownName');
    const nameEn = stop ? stop.nameEn : '';
    if (stop) enrichRecentStop(stopCode, nameTc, stop.nameSc || '', nameEn);
    if (stopUnknown) pruneRecentStops();
    header.appendChild(buildStopHeader(stopCode, nameTc, nameEn, 'LRT', '', stopUnknown));
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    const stationId = stop && stop.id ? stop.id : null;
    if (!stationId) {
      // v34: a poisoned/unknown stop gets the rich empty state via
      // buildStopEmptyState's CTAs + the new back-to-home pill so the
      // user has somewhere to go from this dead-end page.
      body.replaceChildren(el('p', { class: 'empty' }, t_str('stopNotFound')));
      appendStopUnknownCTA(body, stopCode);
      return;
    }

    // LRT stops currently lack WGS84 coords in the official sources. The
    // map section is only rendered when we actually have lat/lng.

    fetchLrtSchedule(stationId)
      .then((resp) => {
        if (!resp || !Array.isArray(resp.platform_list)) {
          body.replaceChildren(el('p', { class: 'empty' }, t_str('noEta')));
          // v34: same back-to-home CTA pattern as the bus + GMB stop
          // views so the user always has somewhere to go.
          appendStopUnknownCTA(body, stopCode);
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
            main.appendChild(
              el(
                'div',
                { class: 'row-title' },
                tr.route_no,
                el('span', { style: 'color: var(--muted); margin: 0 6px; font-weight: 500;' }, '·'),
                tr.dest_ch || tr.dest_en || ''
              )
            );
            const min = parseInt(tr.time_en, 10);
            main.appendChild(el('div', { class: 'row-sub' }, tr.special ? t_str('scheduled') : ''));
            row.appendChild(main);
            const meta = el('div', { class: 'row-meta' });
            if (Number.isFinite(min)) {
              meta.appendChild(
                el(
                  'span',
                  { class: 'row-eta' + (min <= 2 ? ' is-soon' : '') },
                  `${min} ${t_str('minShort')}`
                )
              );
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
      })
      .catch(() => body.replaceChildren(el('p', { class: 'empty' }, t_str('noEta'))));

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
    // QW-1: Seed the GMB stop header from the local stop index so the
    // heading never sits on the raw numeric operator ID while waiting
    // for primeGmbStopCoord to enrich.
    //
    // v34: when the local GMB stop index has nothing for this ID, fall
    // back to t_str('stopUnknownName') and surface the raw ID as a muted
    // sub-line — same UX as the bus + LRT paths. Prune any poisoned
    // recent entry on the off-chance this ID is no longer valid.
    const gmbSeed = (state.index && state.index.stops && state.index.stops.get(stopId)) || null;
    const gmbSeedUnknown = !gmbSeed;
    const gmbSeedNameTc = (gmbSeed && gmbSeed.nameTc) || t_str('stopUnknownName');
    const gmbSeedNameEn = (gmbSeed && gmbSeed.nameEn) || '';
    const gmbSeedNameSc = (gmbSeed && gmbSeed.nameSc) || '';
    if (gmbSeedUnknown) pruneRecentStops();
    header.appendChild(
      buildStopHeader(stopId, gmbSeedNameTc, gmbSeedNameEn, 'GMB', gmbSeedNameSc, gmbSeedUnknown)
    );
    body.appendChild(el('p', { class: 'muted' }, t_str('loading')));

    // Try to enrich the stop with a real name + coordinates.
    primeGmbStopCoord(stopId).then((meta) => {
      // v34: if primeGmbStopCoord returned no meta AND the seed didn't
      // have it either, keep the friendly fallback + ID sub-line. If
      // meta came back, the unknown flag is cleared and the ID sub-line
      // disappears in the next render.
      if (meta)
        header.replaceChildren(
          ...buildStopHeader(
            stopId,
            meta.nameTc || stopId,
            meta.nameEn || '',
            'GMB',
            meta.nameSc || '',
            false
          ).childNodes
        );
      // Stash for the map append after the routes list renders.
      state._lastGmbStopMeta = meta || null;
      // Cache the resolved name on the recent entry so 最近查過 shows the
      // real GMB stop name instead of just the numeric operator ID.
      if (meta && meta.nameTc)
        enrichRecentStop(stopId, meta.nameTc, meta.nameSc || '', meta.nameEn || '');
    });

    fetchGmbStopRoutes(stopId)
      .then(async (resp) => {
        const list = resp && Array.isArray(resp.data) ? resp.data : [];
        if (list.length === 0) {
          body.replaceChildren(el('p', { class: 'empty' }, t_str('noEta')));
          // v34: surface the back-to-home CTA so they have somewhere to go
          // when the GMB upstream returns nothing for this ID.
          appendStopUnknownCTA(body, stopId);
          return;
        }
        // Fetch ETA per route×stop_seq for first route only, then show others as "schedule only".
        const rows = [];
        for (const r of list) {
          rows.push({
            routeId: r.route_id,
            routeSeq: r.route_seq,
            stopSeq: r.stop_seq,
            name: r.name_tc,
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
          li.appendChild(
            el(
              'div',
              { class: 'row-meta' },
              row === head && etaInfo
                ? el('span', { class: 'row-eta' }, `${etaInfo.diff} ${t_str('minShort')}`)
                : el('div', { class: 'row-dim' }, t_str('scheduled'))
            )
          );
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
      })
      .catch(() => body.replaceChildren(el('p', { class: 'empty' }, t_str('noEta'))));

    startEtaRefresh(renderStopDetail);
  }

  // Stop view header — modeled on justarrived.grok.me:
  // back chevron + language toggle (top bar), small operator pill, big stop name,
  // red accent rule, "剛剛更新 · HH:MM" sub-line.
  //
  // v34: when `stopUnknown` is true (neither the local index, the operator-ID
  // reverse map, nor the upstream API could resolve a name), the heading
  // falls back to t_str('stopUnknownName') and a muted sub-line surfaces the
  // raw ID (e.g. "ID: 0C81107C…") so the user can still copy / share /
  // debug a poisoned 16-hex ID like 0C81107C4ABFCD7C.
  function buildStopHeader(stopId, nameTc, nameEn, co, nameSc, stopUnknown) {
    const head = el('div', { class: 'stop-header' });

    // ---- top action bar ----
    const topbar = el('div', { class: 'stop-topbar' });
    topbar.appendChild(
      el(
        'a',
        {
          class: 'stop-back',
          'aria-label': t_str('back'),
          href: '#/',
        },
        (function () {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('width', '22');
          svg.setAttribute('height', '22');
          svg.setAttribute('aria-hidden', 'true');
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          p.setAttribute('fill', 'none');
          p.setAttribute('stroke', 'currentColor');
          p.setAttribute('stroke-width', '2');
          p.setAttribute('stroke-linecap', 'round');
          p.setAttribute('stroke-linejoin', 'round');
          p.setAttribute('d', 'M15 6l-6 6 6 6');
          svg.appendChild(p);
          return svg;
        })()
      )
    );

    const topRight = el('div', { class: 'stop-topbar-right' });
    // The pill shows the *current* language; clicking cycles to the next one.
    const langPill = el(
      'span',
      { class: 'stop-lang-pill' },
      state.lang === 'zh-Hant' ? '繁體中文' : state.lang === 'zh-Hans' ? '简体中文' : 'English'
    );
    topRight.appendChild(langPill);

    const isFav = state.savedStops.some((s) => sameStop(s, { stop: stopId }));
    const star = el('button', {
      type: 'button',
      class: `stop-fav ${isFav ? 'is-fav' : ''}`,
      'aria-label': isFav ? t_str('saved') : t_str('save'),
      'aria-pressed': String(isFav),
      onclick: () => {
        toggleSaveStop({ stop: stopId });
        head.replaceChildren(
          ...buildStopHeader(stopId, nameTc, nameEn, co, undefined, stopUnknown).childNodes
        );
      },
    });
    star.appendChild(starIconSVG(isFav));
    topRight.appendChild(star);
    topbar.appendChild(topRight);
    head.appendChild(topbar);

    // ---- operator pill (small, above title) ----
    if (co && co !== 'STOP') {
      head.appendChild(el('span', { class: 'stop-op-pill' }, t_str(busetaUtils.opCoKey(co))));
    }

    // ---- main stop name ----
    head.appendChild(
      el('h1', { class: 'stop-name' }, nameFor({ nameTc, nameSc: nameSc || '', nameEn }) || stopId)
    );
    // v34: When the stop is unresolvable, surface the raw ID as a muted
    // sub-line so the user can still copy / share / debug it. Truncated
    // to 8 chars + an ellipsis — long enough to identify the bug, short
    // enough not to crowd the heading on mobile.
    if (stopUnknown) {
      const raw = String(stopId || '');
      const short = raw.length > 8 ? raw.slice(0, 8) + '…' : raw;
      head.appendChild(
        el('p', { class: 'stop-name-id' }, `${t_str('stopUnknownIdLabel')}: ${short}`)
      );
    }
    if (nameEn) head.appendChild(el('p', { class: 'stop-name-en' }, nameEn));

    // ---- red accent rule ----
    head.appendChild(el('div', { class: 'stop-accent' }));

    // ---- "updated HH:MM" + refresh button ----
    const meta = el('div', { class: 'stop-meta' });
    const updateLeft = el('div', { class: 'stop-meta-left' });
    updateLeft.appendChild(
      el(
        'p',
        { class: 'stop-updated-when', 'data-bind': 'stop-updated-when' },
        t_str('updatedJust')
      )
    );
    // QW-8: countdown chip — counts down to the next auto-refresh.
    updateLeft.appendChild(
      buildRefreshProgress(state._nextRefreshAt || Date.now() + REFRESH_INTERVAL_MS)
    );
    meta.appendChild(updateLeft);
    const refreshBtn = el(
      'button',
      {
        type: 'button',
        class: 'stop-refresh',
        'aria-label': t_str('refresh'),
        onclick: () => {
          if (typeof state._refreshStop === 'function') {
            // Respect the current tab: live refresh re-renders the arrivals,
            // schedule refresh re-pulls the timetable.
            state._refreshStop({ mode: state._stopViewMode === 'schedule' ? 'schedule' : 'live' });
          } else {
            location.reload();
          }
        },
      },
      refreshIconSVG()
    );
    const shareBtn = el(
      'button',
      {
        type: 'button',
        class: 'share-btn stop-share',
        'aria-label': t_str('shareLinkAria'),
        title: t_str('shareLink'),
        onclick: (ev) => {
          ev.stopPropagation();
          const url = location.origin + location.pathname + `#/stop/${encodeURIComponent(stopId)}`;
          copyShareLink(url, t_str('shareLinkAria'));
        },
      },
      shareIconSVG()
    );
    meta.appendChild(refreshBtn);
    meta.appendChild(shareBtn);
    head.appendChild(meta);

    return head;
  }

  // v34: Append a small "Back to home" CTA into the stop view when the
  // requested stop cannot be resolved by any local lookup or the upstream
  // API. The rich QW-5 empty state already provides Schedule + Retry
  // buttons (refreshBusStopView renders it), but for a truly poisoned ID
  // those don't help — the user needs somewhere to go. The CTA is a
  // secondary accent pill so it doesn't fight the empty state visually.
  function appendStopUnknownCTA(panel, stopId) {
    if (!panel) return;
    const wrap = el('div', { class: 'stop-unknown-cta' });
    wrap.appendChild(el('p', { class: 'stop-unknown-sub' }, t_str('stopUnknownSub')));
    const cta = el(
      'a',
      {
        class: 'stop-unknown-back',
        href: '#/',
        role: 'button',
      },
      t_str('stopUnknownCtaBack')
    );
    wrap.appendChild(cta);
    panel.appendChild(wrap);
  }

  function toggleSaveStop(s) {
    const i = state.savedStops.findIndex((x) => sameStop(x, s));
    if (i >= 0) {
      state.savedStops.splice(i, 1);
      toast(t_str('unsave'));
    } else {
      state.savedStops.push(s);
      toast(t_str('saved'));
    }
    persist();
    pushRecent({ ...s });
  }

  function renderStopDetail() {
    // Periodic refresh hook. When on Live, repaint just the panel (avoids
    // rebuilding the whole tab control). When on Schedule, silently warm
    // the cache so the next explicit click returns the latest data.
    if (!state.detailStop) return;
    const stopId = state.detailStop.stop;
    const isCtb = typeof stopId === 'string' && /^[0-9]{6}$/.test(stopId);
    if (state._stopViewMode === 'schedule') {
      fetchStopSchedule(stopId, isCtb).catch(() => {});
      return;
    }
    if (state._refreshStop) state._refreshStop({ mode: 'live' });
  }

  // ------------------------------------------------------------------
  // Error view
  // ------------------------------------------------------------------
  function renderError() {
    showView('view-error');
    const view = renderInto('error', 'error');
    const btn = $('#errorRetry', view);
    btn.addEventListener('click', () => {
      location.hash = '#/';
    });
  }

  // ------------------------------------------------------------------
  // Planner view (A → B trip planner) — rendering lives in planner.js
  // ------------------------------------------------------------------
  function renderPlannerView() {
    showView('view-planner');
    const view = document.getElementById('view-planner');
    if (!view) return;
    // Planner.js + planner.css are lazy-loaded on first visit. The inline
    // bootstrap in index.html installs `window.__buseta.loadPlannerScript`
    // and `loadPlannerCss` which fetch + inject them on demand and cache
    // the promise so subsequent navigations don't refetch.
    const ready = window.__buseta
      ? Promise.all([window.__buseta.loadPlannerScript(), window.__buseta.loadPlannerCss()])
      : Promise.reject(new Error('Lazy planner loader missing'));
    ready
      .then(() => {
        if (window.Planner && typeof window.Planner.renderPlanner === 'function') {
          window.Planner.renderPlanner(view);
        } else {
          view.innerHTML =
            '<div class="container" style="padding: 24px 16px; color: var(--muted);">Trip planner failed to load.</div>';
        }
      })
      .catch((err) => {
        console.warn('Planner load failed', err);
        view.innerHTML =
          '<div class="container" style="padding: 24px 16px; color: var(--muted);">Trip planner failed to load.</div>';
      });
  }

  // ------------------------------------------------------------------
  // Settings view (QW-3) — pulled out of the home view into a dedicated
  // surface so it doesn't compete with the actual home content for
  // attention. Three sections: Theme, Notifications (reuses
  // renderNotifSettings), and an About block.
  // ------------------------------------------------------------------
  function renderSettings() {
    showView('view-settings');
    const view = document.getElementById('view-settings');
    if (!view) return;
    view.innerHTML = '';
    // Cache the build version for the Settings → About card. Pulled from
    // <meta name="buseta-version"> set in index.html so the displayed
    // version matches the shipped cache-buster bump.
    if (!window.__busetaVersion) {
      const meta = document.querySelector('meta[name="buseta-version"]');
      window.__busetaVersion = meta ? meta.getAttribute('content') : '—';
    }

    const container = el('div', { class: 'container settings-view' });

    // Header: back chevron + title.
    const topbar = el('div', { class: 'settings-topbar' });
    topbar.appendChild(
      el(
        'a',
        {
          class: 'settings-back',
          href: '#/',
          'aria-label': t_str('back'),
        },
        (function () {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('width', '22');
          svg.setAttribute('height', '22');
          svg.setAttribute('aria-hidden', 'true');
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          p.setAttribute('fill', 'none');
          p.setAttribute('stroke', 'currentColor');
          p.setAttribute('stroke-width', '2');
          p.setAttribute('stroke-linecap', 'round');
          p.setAttribute('stroke-linejoin', 'round');
          p.setAttribute('d', 'M15 6l-6 6 6 6');
          svg.appendChild(p);
          return svg;
        })()
      )
    );
    topbar.appendChild(el('h1', { class: 'settings-title' }, t_str('settingsTitle')));
    container.appendChild(topbar);

    // ----- Section: Theme -----
    container.appendChild(el('h2', { class: 'settings-section-title' }, t_str('settingsTheme')));
    const themeCard = el('div', {
      class: 'settings-card',
      role: 'radiogroup',
      'aria-label': t_str('settingsTheme'),
    });
    const modes = [
      { key: 'system', labelKey: 'themeSystem' },
      { key: 'light', labelKey: 'themeLight' },
      { key: 'dark', labelKey: 'themeDark' },
    ];
    let storedTheme;
    try {
      storedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    } catch {
      storedTheme = null;
    }
    const currentTheme =
      VALID_THEMES.has(storedTheme) && storedTheme !== 'system' ? storedTheme : 'system';
    modes.forEach((m) => {
      const isOn = currentTheme === m.key;
      const btn = el(
        'button',
        {
          type: 'button',
          class: 'settings-pill' + (isOn ? ' is-on' : ''),
          role: 'radio',
          'aria-checked': isOn ? 'true' : 'false',
          onclick: () => {
            setTheme(m.key);
            renderSettings();
          },
        },
        t_str(m.labelKey)
      );
      themeCard.appendChild(btn);
      // i18n re-apply doesn't catch programmatic text — labelKey is
      // already resolved via t_str() above, so no follow-up needed.
    });
    container.appendChild(themeCard);

    // ----- Section: Notifications (re-uses renderNotifSettings) -----
    container.appendChild(el('h2', { class: 'settings-section-title' }, t_str('notifEnable')));
    const notifMount = el('div', { class: 'settings-notif-mount' });
    container.appendChild(notifMount);
    renderNotifSettings(notifMount);

    // ----- Section: About -----
    container.appendChild(el('h2', { class: 'settings-section-title' }, t_str('settingsAbout')));
    const about = el('div', { class: 'settings-card settings-about' });
    about.appendChild(
      el('p', { class: 'settings-about-row' }, [
        el('span', { class: 'settings-about-label' }, t_str('settingsVersion')),
        el('span', { class: 'settings-about-value' }, 'v' + (window.__busetaVersion || '—')),
      ])
    );
    about.appendChild(
      el('p', { class: 'settings-about-row' }, [
        el('span', { class: 'settings-about-label' }, t_str('settingsDataSource')),
        el(
          'span',
          { class: 'settings-about-value' },
          t_str('footerAttribution').split('：')[0] || t_str('settingsDataSource')
        ),
      ])
    );
    about.appendChild(
      el(
        'a',
        {
          class: 'settings-link',
          href: '#/',
          'aria-label': t_str('settingsBackHome'),
        },
        t_str('settingsBackHome')
      )
    );
    container.appendChild(about);

    view.appendChild(container);
  }

  // ------------------------------------------------------------------
  // Recent
  // ------------------------------------------------------------------
  function pushRecent(item) {
    const key = item.stop
      ? JSON.stringify({ stop: item.stop, co: item.co || 'STOP' })
      : JSON.stringify(makeRouteKey(item.co, item.route, item.dir, item.service));
    state.recent = [
      item,
      ...state.recent.filter((x) => {
        const k = x.stop
          ? JSON.stringify({ stop: x.stop, co: x.co || 'STOP' })
          : JSON.stringify(makeRouteKey(x.co, x.route, x.dir, x.service));
        return k !== key;
      }),
    ].slice(0, 20);
    persist();
  }

  // After a stop view resolves its real name from the operator endpoint, write
  // the name fields back into the matching recent entry so the home page can
  // render the actual stop name instead of falling back to the raw operator
  // ID (e.g. "002256" for CTB, "ST905" for KMB). Without this, hk-stops.json
  // doesn't index KMB stops by operator ID and the recent row shows just the
  // raw id + a sliced hash sub-line.
  function enrichRecentStop(stopId, nameTc, nameSc, nameEn) {
    if (!stopId || !nameTc) return;
    // Guard: never cache the operator ID itself as the "resolved name".
    // This happens for KMB operator codes (ST905) — the upstream /stop/{id}
    // endpoint returns empty because it expects the internal 16-hex ID, not
    // the operator-facing code. The reverse map (kmbOperatorId) handles the
    // direct-nav case; this guard just keeps a poison-write from making
    // things worse if the reverse map is somehow missing.
    if (nameTc === stopId) return;
    // Strip the trailing "(ST905)" suffix from upstream / direct-fetch names
    // so the recent row title reads "大學站" instead of "大學站 (ST905)".
    const cleanTc = busetaUtils.stripKmbOpSuffix(nameTc) || nameTc;
    const cleanSc = busetaUtils.stripKmbOpSuffix(nameSc) || nameSc;
    const cleanEn = busetaUtils.stripKmbOpSuffix(nameEn) || nameEn;
    let changed = false;
    state.recent.forEach((x) => {
      if (x.stop !== stopId) return;
      if (x.nameTc === cleanTc && x.nameSc === cleanSc && x.nameEn === cleanEn) return;
      x.nameTc = cleanTc;
      x.nameSc = cleanSc;
      x.nameEn = cleanEn;
      changed = true;
    });
    if (changed) persist();
  }

  // v34 · Prune poisoned recent stop entries.
  //
  // When a stop view opens an ID that the local index, the operator-ID
  // reverse map, AND the upstream endpoint cannot name, the entry is almost
  // certainly stale (e.g. a 16-hex KMB ID from an old session that's no
  // longer in the upstream list). Drop every `state.recent` row whose
  // `stop` field fails to resolve via any local source so the home page
  // stops re-suggesting dead links.
  //
  // - KMB / CTB / GMB stops live in `state.index.stops`.
  // - LRT stops live in `state.index.lrt.stops`.
  // - KMB operator-facing IDs (e.g. "ST905") live in the
  //   `state.index.kmbOperatorId` reverse map built at index time.
  //
  // Route-only recent entries (no `stop` field) are always kept.
  function pruneRecentStops() {
    if (!state.recent || state.recent.length === 0) return;
    const stops = (state.index && state.index.stops) || null;
    const opMap = (state.index && state.index.kmbOperatorId) || null;
    const lrtStops = (state.index && state.index.lrt && state.index.lrt.stops) || null;
    const filtered = state.recent.filter((x) => {
      if (!x || !x.stop) return true; // keep route entries
      if (x.co === 'LRT') return !!(lrtStops && lrtStops.get(x.stop));
      if (stops && stops.get(x.stop)) return true;
      if (opMap && opMap.get(x.stop)) return true;
      return false;
    });
    if (filtered.length !== state.recent.length) {
      state.recent = filtered;
      persist();
    }
  }

  // ------------------------------------------------------------------
  // Auto-refresh
  // ------------------------------------------------------------------
  function startEtaRefresh(fn) {
    clearInterval(state.refreshTimer);
    clearInterval(state._refreshCountdown);
    // QW-8: track the next refresh time so the countdown chip can paint.
    state._nextRefreshAt = Date.now() + REFRESH_INTERVAL_MS;
    paintRefreshCountdown();
    state.refreshTimer = setInterval(() => {
      fn();
      state._nextRefreshAt = Date.now() + REFRESH_INTERVAL_MS;
      updateRouteTimestamp();
    }, REFRESH_INTERVAL_MS);
    state._refreshCountdown = setInterval(paintRefreshCountdown, 1000);
    updateRouteTimestamp();
  }
  function paintRefreshCountdown() {
    if (!state._nextRefreshAt) return;
    const next = state._nextRefreshAt;
    document.querySelectorAll('.refresh-progress').forEach((wrap) => {
      const text = wrap.querySelector('.refresh-progress-text');
      const bar = wrap.querySelector('.refresh-progress-bar');
      const ms = Math.max(0, next - Date.now());
      const sec = Math.ceil(ms / 1000);
      if (text) text.textContent = t_str('refreshProgressLabel', sec);
      if (bar)
        bar.style.setProperty(
          '--refresh-progress',
          String(Math.max(0, Math.min(1, ms / REFRESH_INTERVAL_MS)))
        );
    });
  }
  function updateRouteTimestamp() {
    // Both route and stop views have an "updated HH:MM" element — find the
    // one in the currently visible view so refresh never bleeds across views.
    const candidates = document.querySelectorAll(
      '[data-bind="route-updated-when"], [data-bind="stop-updated-when"]'
    );
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
    if (state.refreshTimer) {
      clearInterval(state.refreshTimer);
      state.refreshTimer = null;
    }
    // Pause the vehicle-map auto-refresh too so navigating away from
    // the route detail view drops the 30s polling. startVehicleRefresh
    // is called by renderBusRoute when the map is first rendered.
    stopVehicleRefresh();
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
  function toast(msg, durationMs) {
    let node = document.querySelector('.toast');
    if (!node) {
      node = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(node);
    }
    node.textContent = msg;
    requestAnimationFrame(() => node.classList.add('is-on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('is-on'), durationMs || 1800);
  }
  // SR-7 · Expose `toast` so the inline SW-install handler in index.html
  // can fire the offline-onboarding toast without a back-reference.
  window.__busetaToast = toast;

  // ------------------------------------------------------------------
  // Share (copy clean URL + inline QR)
  //
  // `url` is a fully-qualified URL (location.origin + the clean hash path)
  // that we want the recipient to be able to load offline-friendly. The
  // clean URL has no query string — just the same hash path the current
  // view was reached from (e.g. `#/stop/ST905` or `#/route/KMB/272A/O/1`).
  // ------------------------------------------------------------------
  let qrModalNode = null; // cached DOM node, recreated on demand
  let qrModalTimer = null; // auto-close timer for the QR popover
  let qrLibPromise = null; // one-shot lazy-load of assets/qrcode.js

  // Lazy-load the vendored QR generator (assets/qrcode.js) the first time
  // we need to draw a QR. After the first success we cache the promise so
  // subsequent share clicks reuse the same module.
  function ensureQrLib() {
    if (typeof qrToSvg === 'function') return Promise.resolve();
    if (qrLibPromise) return qrLibPromise;
    qrLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      // Cache-buster matches the project's convention. We only bump this
      // locally for now; the SW owns its own version.
      s.src = 'assets/qrcode.js?v=11';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        // Reset so the next tap can retry.
        qrLibPromise = null;
        reject(new Error('qrcode.js failed to load'));
      };
      document.head.appendChild(s);
    });
    return qrLibPromise;
  }

  // Build the share URL we want the recipient to see — same origin + the
  // current hash path. Strip any query string to keep the link clean.
  function buildCleanUrl() {
    const { origin } = location;
    let hash = location.hash || '';
    // Strip anything after a '?' in the hash (defensive — no production
    // route builds one, but a tampered URL shouldn't leak through).
    const qIdx = hash.indexOf('?');
    if (qIdx >= 0) hash = hash.slice(0, qIdx);
    if (!hash.startsWith('#')) hash = '#' + (hash ? '/' + hash.replace(/^#?\/?/, '') : '/');
    return origin + hash;
  }

  // Copy `url` to the clipboard, falling back to a hidden textarea when
  // navigator.clipboard is unavailable (older browsers, insecure context).
  // Resolves true on success, false on failure.
  async function copyToClipboard(url) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        return true;
      }
    } catch (_) {
      /* fall through to legacy path */
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.select();
      const res = document.execCommand('copy');
      document.body.removeChild(ta);
      return res;
    } catch (_) {
      return false;
    }
  }

  // Public helper used by the share buttons. Copies the clean URL, shows
  // the existing toast, and pops the inline QR modal. `label` is an
  // aria-label hint (the language-specific button name).
  async function copyShareLink(url, label) {
    const finalUrl = url || buildCleanUrl();
    // Run copy and library load in parallel — the modal only opens after
    // both settle, but the toast fires as soon as copy resolves so the
    // user gets instant feedback even if the QR library is slow.
    const copyPromise = copyToClipboard(finalUrl);
    copyShareLink._lastUrl = finalUrl;
    try {
      const ok = await copyPromise;
      toast(ok ? t_str('linkCopied') : t_str('shareLink'));
      if (!ok) return;
    } catch (_) {
      toast(t_str('shareLink'));
      return;
    }
    renderQrModal(finalUrl, label);
  }

  // Show a small inline modal anchored to the share button containing the
  // QR code for `url`. Auto-closes after ~6s, on outside tap, or when the
  // user taps the close button. Recreates the node each time so the QR
  // is always fresh for the current URL.
  function renderQrModal(url, label) {
    closeQrModal();
    const wrap = el('div', {
      class: 'qr-modal',
      role: 'dialog',
      'aria-label': label || t_str('shareLinkAria'),
      'aria-live': 'polite',
    });
    const card = el('div', { class: 'qr-modal-card' });
    const close = el(
      'button',
      {
        type: 'button',
        class: 'qr-modal-close',
        'aria-label': t_str('back'),
      },
      '×'
    );
    close.addEventListener('click', closeQrModal);
    const title = el('p', { class: 'qr-modal-title' }, t_str('shareLink'));
    const imgWrap = el('div', { class: 'qr-modal-img' });
    // Reserve the size so the modal doesn't jump while the library loads.
    imgWrap.style.width = '120px';
    imgWrap.style.height = '120px';
    const urlP = el('p', { class: 'qr-modal-url' }, url);
    card.appendChild(close);
    card.appendChild(title);
    card.appendChild(imgWrap);
    card.appendChild(urlP);
    wrap.appendChild(card);
    document.body.appendChild(wrap);
    qrModalNode = wrap;
    // Outside-tap dismiss
    wrap.addEventListener('click', (ev) => {
      if (ev.target === wrap) closeQrModal();
    });
    // Escape key dismiss
    const onKey = (ev) => {
      if (ev.key === 'Escape') closeQrModal();
    };
    wrap.addEventListener('keydown', onKey);
    wrap._onKey = onKey;
    // a11y: Phase 15 — focus trap. Tab cycles within the modal so a
    // keyboard user can't escape to the page behind. Focus moves to the
    // close button on open and returns to the trigger on close. The
    // trigger is the share button that opened the modal — passed via
    // the `label` caller path is the share button's text; we look up
    // the live activeElement (which is whatever focused element opened
    // the modal via copyShareLink's call site). Saved on `wrap` so
    // closeQrModal can hand it to the trap later.
    wrap._trigger = document.activeElement;
    if (typeof busetaUtils.createFocusTrap === 'function') {
      wrap._focusTrap = busetaUtils.createFocusTrap(wrap, {
        initialFocus: close,
        returnFocus: wrap._trigger,
      });
      wrap._focusTrap.activate();
    }
    // Animate in
    requestAnimationFrame(() => wrap.classList.add('is-on'));
    // Auto-close after 8s
    clearTimeout(qrModalTimer);
    qrModalTimer = setTimeout(closeQrModal, 8000);
    // Lazy-load the QR lib and draw
    ensureQrLib()
      .then(() => {
        if (!qrModalNode || qrModalNode !== wrap) return;
        try {
          const svg = qrToSvg(url, 120);
          imgWrap.innerHTML = svg;
        } catch (err) {
          console.warn('qr render failed', err);
          imgWrap.textContent = t_str('qrFailed');
        }
      })
      .catch((err) => {
        console.warn('qr lib load failed', err);
        if (imgWrap) imgWrap.textContent = t_str('qrFailed');
      });
  }

  function closeQrModal() {
    clearTimeout(qrModalTimer);
    qrModalTimer = null;
    if (qrModalNode) {
      const node = qrModalNode;
      node.classList.remove('is-on');
      // a11y: Phase 15 — deactivate the focus trap so Tab cycles the
      // page again and focus returns to the trigger button.
      if (node._focusTrap) {
        try {
          node._focusTrap.deactivate();
        } catch (_) {
          /* swallow — focus restoration is best-effort */
        }
        node._focusTrap = null;
      }
      // Drop from the DOM after the fade-out
      setTimeout(() => {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 180);
      qrModalNode = null;
    }
  }

  // Small inline SVG: link / chain glyph used by the share buttons.
  function shareIconSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    // Two interlocking chain links — Material-style.
    const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p1.setAttribute(
      'd',
      'M10.59 13.41a1 1 0 0 1 0-1.41l3-3a1 1 0 1 1 1.41 1.41l-3 3a1 1 0 0 1-1.41 0z'
    );
    p1.setAttribute('fill', 'none');
    p1.setAttribute('stroke', 'currentColor');
    p1.setAttribute('stroke-width', '1.8');
    p1.setAttribute('stroke-linecap', 'round');
    p1.setAttribute('stroke-linejoin', 'round');
    const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p2.setAttribute('d', 'M9 7a3 3 0 0 1 4.24 0l1.76 1.76a3 3 0 0 1 0 4.24l-1 1');
    p2.setAttribute('fill', 'none');
    p2.setAttribute('stroke', 'currentColor');
    p2.setAttribute('stroke-width', '1.8');
    p2.setAttribute('stroke-linecap', 'round');
    p2.setAttribute('stroke-linejoin', 'round');
    const p3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p3.setAttribute('d', 'M15 17a3 3 0 0 1-4.24 0l-1.76-1.76a3 3 0 0 1 0-4.24l1-1');
    p3.setAttribute('fill', 'none');
    p3.setAttribute('stroke', 'currentColor');
    p3.setAttribute('stroke-width', '1.8');
    p3.setAttribute('stroke-linecap', 'round');
    p3.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p1);
    svg.appendChild(p2);
    svg.appendChild(p3);
    return svg;
  }

  // ------------------------------------------------------------------
  // Local notifications (Web Notification API)
  //
  // Fires `new Notification(...)` when a saved or recently-viewed stop
  // has an ETA crossing below the user's chosen threshold (3 / 5 / 10
  // minutes). Only works while the tab is open — this is the static
  // GitHub Pages site, no backend, no VAPID push. The polling timer
  // pauses while the page is hidden (`document.visibilityState`) and
  // restarts when it becomes visible again. Edge-detection
  // (`state.notifEdge`) ensures we only fire on the above → below
  // transition; once a notification has been delivered for a given
  // (stop, route, dir, serviceType) tuple, the same tag suppresses
  // further notifications until the ETA moves back above threshold.
  // ------------------------------------------------------------------
  const NOTIF_POLL_MS = 20_000;
  const NOTIF_THRESHOLDS = [3, 5, 10];

  function notifSupported() {
    return typeof Notification !== 'undefined';
  }
  // Pull the unique list of stop IDs the user is currently tracking
  // through either their saved-stops or recent-stops lists. Each entry
  // includes the cached name so the notification body can read e.g.
  // "272A 將於 3 分鐘內到達大學站" without a second lookup.
  function collectNotifStops() {
    const seen = new Set();
    const out = [];
    const push = (s) => {
      if (!s || !s.stop) return;
      const id = String(s.stop);
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        stop: s.stop,
        co: s.co || '',
        nameTc: s.nameTc || '',
        nameSc: s.nameSc || '',
        nameEn: s.nameEn || '',
      });
    };
    (state.savedStops || []).forEach(push);
    (state.recent || []).forEach((r) => {
      if (r && r.stop) push(r);
    });
    return out;
  }

  function ensureNotifTimer() {
    if (!notifSupported()) return;
    if (state.notifTimer) return;
    state.notifTimer = setInterval(notifTick, NOTIF_POLL_MS);
  }
  function stopNotifTimer() {
    if (state.notifTimer) {
      clearInterval(state.notifTimer);
      state.notifTimer = null;
    }
  }
  function refreshNotifTimer() {
    stopNotifTimer();
    if (
      state.notifEnabled &&
      notifSupported() &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible'
    ) {
      ensureNotifTimer();
      // Fire an immediate tick so returning to the tab doesn't wait 20s
      // before the first edge-crossing notification.
      notifTick();
    }
  }

  // One polling tick. Bails early if the page is hidden, permission has
  // been revoked, or a tick is already running. For every (stop, route)
  // with a soonest ETA at-or-below the threshold and whose previous
  // edge state was 'above', fire `new Notification(...)` once.
  async function notifTick() {
    if (state.notifInFlight) return;
    if (!state.notifEnabled) return;
    if (!notifSupported() || Notification.permission !== 'granted') return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

    const stops = collectNotifStops();
    if (stops.length === 0) {
      // Even with nothing to monitor, keep the timer alive so newly
      // saved stops start getting watched on the next tick.
      return;
    }
    state.notifInFlight = true;
    try {
      const results = await Promise.all(
        stops.map(async (s) => {
          try {
            const etaResp = await fetchEtaForStopLocal(s.stop);
            return { stop: s, eta: etaResp && Array.isArray(etaResp.data) ? etaResp.data : [] };
          } catch (e) {
            return { stop: s, eta: [] };
          }
        })
      );

      // Update the edge map for every observed (stop, co, route, dir,
      // serviceType). Fire a notification only on the above → below
      // transition.
      const seenKeys = new Set();
      const threshold = Number(state.notifThresholdMin) || 5;
      for (const r of results) {
        if (!r.eta || r.eta.length === 0) continue;
        const stopName =
          nameFor({
            nameTc: r.stop.nameTc,
            nameSc: r.stop.nameSc,
            nameEn: r.stop.nameEn,
          }) || String(r.stop.stop);
        for (const item of r.eta) {
          if (!item || !item.eta) continue;
          const minutes = minutesUntil(item.eta);
          if (minutes == null) continue;
          const co =
            r.stop.co && r.stop.co !== 'STOP'
              ? r.stop.co
              : busetaUtils.classifyKmbOp(item.route, '', item.dest_tc || '');
          const serviceType = item.service_type != null ? String(item.service_type) : '1';
          const dir = item.dir || '';
          const key = `${r.stop.stop}|${co}|${item.route}|${dir}|${serviceType}`;
          seenKeys.add(key);
          const above = minutes > threshold;
          if (above) {
            state.notifEdge.set(key, 'above');
            continue;
          }
          const prev = state.notifEdge.get(key);
          if (prev === 'below') continue; // already fired; don't spam.
          state.notifEdge.set(key, 'below');
          fireNotif(co, item, minutes, stopName, key);
        }
      }
      // Anything in the edge map we didn't see on this tick is presumed
      // gone (stops deleted, route retired). Reset it to 'above' so a
      // future reappearance fires fresh.
      for (const key of Array.from(state.notifEdge.keys())) {
        if (!seenKeys.has(key)) state.notifEdge.delete(key);
      }
    } finally {
      state.notifInFlight = false;
    }
  }

  // Pick the right ETA endpoint for the stop's operator shape. KMB uses
  // 16-hex IDs and exposes all routes via `/stop-eta/{id}`. Citybus uses
  // 6-digit numeric IDs and exposes all routes via the `/batch/stop-eta`
  // batch feed. GMB / NLB are out of scope for v1 (we don't watch them).
  function fetchEtaForStopLocal(stopId) {
    if (typeof stopId !== 'string') return Promise.resolve(null);
    if (/^[0-9a-fA-F]{16}$/.test(stopId)) return fetchKmbStopEta(stopId);
    if (/^[0-9]{6}$/.test(stopId)) return fetchCitybusBatchStopEta(stopId);
    // Best-effort: some KMB-shape operator IDs (rare) still work against
    // the KMB /stop-eta endpoint. The promise may reject; the caller
    // swallows the rejection.
    return fetchKmbStopEta(stopId).catch(() => null);
  }

  // Fire one OS notification. `key` is the dedupe key built in
  // notifTick(); we turn it into a tag that's stable across polls and
  // renotify=true so the same tag can re-fire once the ETA leaves and
  // re-enters the threshold window.
  function fireNotif(co, item, minutes, stopName, stopKey) {
    if (!notifSupported() || Notification.permission !== 'granted') return;
    const dest = pickFirst(item.dest_tc, item.dest_en) || '';
    const route = item.route || '';
    const safeStop = String(stopName || '').replace(/[\r\n]+/g, ' ');
    const title = dest ? `${route} → ${safeStop}` : `${route} · ${safeStop}`;
    const body = t_str('notifMinutesAway', minutes);
    const tag = `eta-threshold:${stopKey}`;
    try {
      const n = new Notification(title, {
        body,
        icon: 'assets/icon.svg',
        badge: 'assets/icon.svg',
        tag,
        renotify: true,
        silent: false,
      });
      // Clicking the notification focuses the matching stop view if the
      // tab is in the background.
      n.onclick = () => {
        try {
          window.focus();
        } catch (_) {}
        try {
          n.close();
        } catch (_) {}
        try {
          const stopId = String(stopKey.split('|')[0] || '');
          if (stopId) location.hash = `#/stop/${encodeURIComponent(stopId)}`;
        } catch (_) {}
      };
    } catch (e) {
      // Notification can throw on insecure contexts or if the user
      // blocks the channel between permission checks. Fail silently
      // — the in-page UI keeps working.
    }
  }

  // Toggle handler attached by `renderNotifSettings()`. Requests
  // permission if needed, persists the new state, and starts/stops
  // the polling timer.
  async function setNotifEnabled(enabled) {
    if (!notifSupported()) return;
    if (!enabled) {
      state.notifEnabled = false;
      try {
        localStorage.setItem(STORAGE_KEYS.NOTIF_ENABLED, '0');
      } catch (_) {}
      stopNotifTimer();
      return;
    }
    // Enabling: make sure the browser still has permission.
    let permission = Notification.permission;
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch (_) {
        permission = 'denied';
      }
    }
    if (permission !== 'granted') {
      // Stays disabled — the UI will flip the toggle back and surface a
      // denied banner on the next render.
      state.notifEnabled = false;
      try {
        localStorage.setItem(STORAGE_KEYS.NOTIF_ENABLED, '0');
      } catch (_) {}
      return;
    }
    state.notifEnabled = true;
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIF_ENABLED, '1');
    } catch (_) {}
    refreshNotifTimer();
  }
  function setNotifThreshold(min) {
    const n = Number(min);
    state.notifThresholdMin = NOTIF_THRESHOLDS.includes(n) ? n : 5;
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIF_THRESHOLD, String(state.notifThresholdMin));
    } catch (_) {}
    // Threshold changed → reset the edge map so re-firing is possible
    // even if the previous threshold was a different value.
    state.notifEdge.clear();
    if (state.notifEnabled) refreshNotifTimer();
  }

  // Build the settings card. Always rendered on the home view. Shows
  // the toggle + threshold pills; if browser permission is denied at
  // the OS level we instead show a one-line "blocked" hint and hide
  // the toggle so we don't keep re-requesting.
  function renderNotifSettings(container) {
    if (!container) return;
    container.innerHTML = '';
    if (!notifSupported()) return; // Browser doesn't support Web Notifications.

    const card = el('section', {
      class: 'notif-settings',
      'aria-label': t_str('notifEnable'),
    });
    const header = el('div', { class: 'notif-settings-header' });
    header.appendChild(el('h2', { class: 'section-title' }, t_str('notifEnable')));
    card.appendChild(header);

    const permission = Notification.permission; // 'granted' | 'denied' | 'default'

    // Always offer the toggle. When permission is 'denied' the OS has
    // blocked the site — the toggle is visually disabled and we surface
    // the banner below instead.
    const row = el('div', { class: 'notif-row' });
    const labelText = el('span', { class: 'notif-label' }, t_str('notifEnable'));
    const toggleAttrs = {
      type: 'button',
      class: 'notif-toggle' + (state.notifEnabled ? ' is-on' : ''),
      role: 'switch',
      'aria-checked': state.notifEnabled ? 'true' : 'false',
      'aria-label': t_str('notifEnable'),
    };
    if (permission === 'denied') toggleAttrs.disabled = 'disabled';
    const toggle = el('button', toggleAttrs);
    if (permission !== 'denied') {
      toggle.addEventListener('click', async () => {
        const wantOn = !state.notifEnabled;
        toggle.classList.toggle('is-on', wantOn);
        toggle.setAttribute('aria-checked', wantOn ? 'true' : 'false');
        await setNotifEnabled(wantOn);
        // Re-render in case the toggle needs to snap back (denied) or
        // the threshold pills just became interactive.
        renderNotifSettings(container);
      });
    }
    row.appendChild(labelText);
    row.appendChild(toggle);
    card.appendChild(row);

    // Threshold pills: 3 / 5 / 10. Only interactive when notifications
    // are enabled; otherwise dimmed so the user can see what the
    // default would be.
    const pills = el('div', { class: 'notif-threshold' });
    pills.appendChild(el('span', { class: 'notif-threshold-label' }, t_str('notifThreshold')));
    const pillRow = el('div', {
      class: 'notif-threshold-pills',
      role: 'radiogroup',
      'aria-label': t_str('notifThreshold'),
    });
    NOTIF_THRESHOLDS.forEach((m) => {
      const isOn = state.notifThresholdMin === m;
      const pill = el(
        'button',
        {
          type: 'button',
          class: 'notif-threshold-pill' + (isOn ? ' is-on' : ''),
          role: 'radio',
          'aria-checked': isOn ? 'true' : 'false',
          disabled: state.notifEnabled ? null : 'disabled',
          onclick: () => {
            if (!state.notifEnabled) return;
            setNotifThreshold(m);
            renderNotifSettings(container);
          },
        },
        t_str('notifThreshold' + m)
      );
      pillRow.appendChild(pill);
    });
    pills.appendChild(pillRow);
    card.appendChild(pills);

    if (permission === 'denied') {
      const denied = el('p', { class: 'notif-status is-denied' }, t_str('notifPermissionDenied'));
      card.appendChild(denied);
    }

    container.appendChild(card);
  }

  // Wire up at-startup: install the visibility listener so the timer
  // can pause when the tab is backgrounded. Safe to call multiple
  // times (the addEventListener call is idempotent because we don't
  // re-attach — but boot() only calls it once).
  function setupLocalNotifications() {
    if (!notifSupported()) return;
    if (setupLocalNotifications._wired) return;
    setupLocalNotifications._wired = true;
    document.addEventListener('visibilitychange', () => {
      refreshNotifTimer();
    });
    if (state.notifEnabled) refreshNotifTimer();
  }

  // ------------------------------------------------------------------
  // Language
  // ------------------------------------------------------------------
  function applyLang() {
    document.documentElement.lang =
      state.lang === 'en' ? 'en' : state.lang === 'zh-Hans' ? 'zh-Hans' : 'zh-Hant';
    // Show the CURRENT language on the toggle pill (not the next one).
    // The button label cycles 繁體中文 → 简体中文 → English on each click.
    const btn = document.getElementById('langToggle');
    if (btn) {
      const cur = btn.querySelector('.lang-current');
      if (cur) {
        cur.textContent =
          state.lang === 'zh-Hant' ? '繁體中文' : state.lang === 'zh-Hans' ? '简体中文' : 'English';
      }
      btn.setAttribute(
        'aria-label',
        state.lang === 'zh-Hant'
          ? '切換語言'
          : state.lang === 'zh-Hans'
            ? '切换语言'
            : 'Switch language'
      );
    }
    applyI18n(document.body);
  }
  function toggleLang() {
    // Cycle: zh-Hant → zh-Hans → en → zh-Hant
    state.lang = state.lang === 'zh-Hant' ? 'zh-Hans' : state.lang === 'zh-Hans' ? 'en' : 'zh-Hant';
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
    loadThemePreference();
    // Re-apply theme if the OS-level preference flips while the app is
    // open and the user is on 'system'. Cheap: only flips when the user
    // hasn't made an explicit choice.
    try {
      const mql = window.matchMedia('(prefers-color-scheme: light)');
      if (mql && typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', () => {
          let stored;
          try {
            stored = localStorage.getItem(STORAGE_KEYS.THEME);
          } catch {
            stored = null;
          }
          if (!(VALID_THEMES.has(stored) && stored !== 'system')) {
            // Either genuinely unpressed, or on 'system' — re-resolve.
            setTheme('system');
          }
        });
      }
    } catch {
      /* matchMedia unavailable */
    }
    updateClock();
    setInterval(updateClock, 30_000);

    document.getElementById('langToggle').addEventListener('click', toggleLang);
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', cycleTheme);
    window.addEventListener('hashchange', onHashChange);
    setupRouteSwipe();
    setupLocalNotifications();

    // Seed the offline flag from localStorage so a returning user who
    // closed the tab offline sees the banner immediately on first
    // paint (no flicker). The browser's `navigator.onLine` is checked
    // as a tiebreaker for users who never saw the offline event fire
    // (e.g. cold start while the radio is off).
    try {
      const storedOffline = readOfflineFlag();
      const liveOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      isOffline = storedOffline || liveOffline;
      if (isOffline) writeOfflineFlag(true);
    } catch {
      /* no DOM / no localStorage */
    }
    // React to connectivity changes for the rest of the session.
    window.addEventListener('online', () => setOffline(false));
    window.addEventListener('offline', () => setOffline(true));

    // Best-effort: load any site-wide config (e.g. the Google Maps API key)
    // before rendering so the embedded map is ready on first visit.
    loadGmapsConfig().catch(() => {});

    // Kick off the index build but DON'T await it — the splash + first
    // home render should not block on the 5 MB hk-stops.json download.
    // loadIndex resolves into state.index and the watcher below re-renders
    // the current view once it lands so populated lists replace the
    // empty-state placeholders we show in the meantime.
    loadIndex()
      .then(() => {
        try {
          if (currentRoute() === 'home') renderHome();
        } catch (e) {
          /* noop */
        }
      })
      .catch((err) => {
        console.error('Index build failed', err);
      });

    if (!location.hash) location.hash = '#/';
    // Probe the browser's remembered permission state on boot so the
    // banner can immediately reflect "blocked at browser level" without
    // waiting for the user to click and hit a silent denial.
    probeGeoPermission().then((st) => {
      if (st === 'denied') {
        setLocationStatus('denied');
        rerenderLocationViews();
      }
    });
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
