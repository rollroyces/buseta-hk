// Parse the share-target query string the OS delivers when a user
// shares text / a URL into the PWA. The app boots at
// `/index.html?text=...&url=...#/`, and the boot code reads
// `location.search` to decide what view to open.
//
// Pure: takes a plain object (or URLSearchParams), returns a
// decision object. No DOM, no storage, no i18n. Tested in
// `tests/unit/share-target.test.js`.
//
// Phase 44 — PWA share-target integration.
//
// Decision rules (priority order):
//
//   1. Look for a hash route (`#/stop/<id>` or `#/route/<co>/<r>/<dir>/<service>`)
//      in the `url` or `text` fields. Hash wins regardless of which
//      field carries it (URL field first because that's where a
//      shared web URL shows up; text second because some apps stuff
//      a URL into the share message body).
//
//   2. Otherwise treat the `text` field as a search query. The helper
//      flags `isRouteNumber: true` when the trimmed text matches
//      `/^\d+[A-Z]?$/` (KMB route numbers like `286C`, plain digits
//      like `10`) so the caller can route to a route search vs. the
//      free-text search box — same UX as typing into the search
//      field.
//
//   3. Empty / missing input returns `{ kind: 'none' }` — the caller
//      should silently fall through to the home view.

const ROUTE_HASH_RE = /^#\/route\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)/;
const STOP_HASH_RE = /^#\/stop\/([^/?\s]+)\/?$/;
const ROUTE_NUMBER_RE = /^\d+[A-Z]?$/;

/**
 * @typedef {{kind: string, [k: string]: any}} ShareDecision
 *
 * `kind` is one of:
 *   - `'stop'`   — open `hash` (e.g. `#/stop/<id>`)
 *   - `'route'`  — open `hash` (e.g. `#/route/<co>/<r>/<dir>/<service>`)
 *   - `'search'` — show the search view with `query` populated
 *   - `'none'`   — no actionable payload; caller should fall through
 */

/**
 * @param {string | URLSearchParams | {text?: string, url?: string} | null | undefined} input
 * @returns {ShareDecision}
 */
export function parseShareTarget(input) {
  let text = '';
  let url = '';
  if (input == null) {
    return { kind: 'none' };
  }
  if (typeof input === 'string') {
    try {
      const sp = new URLSearchParams(input.startsWith('?') ? input : `?${input}`);
      text = sp.get('text') || '';
      url = sp.get('url') || '';
    } catch (_) {
      return { kind: 'none' };
    }
  } else if (typeof URLSearchParams !== 'undefined' && input instanceof URLSearchParams) {
    text = input.get('text') || '';
    url = input.get('url') || '';
  } else if (typeof input === 'object') {
    text = typeof input.text === 'string' ? input.text : '';
    url = typeof input.url === 'string' ? input.url : '';
  }

  // 1. Hash route, preferring `url` (where a shared web link shows
  //    up) over `text` (which is more likely to carry free text).
  for (const source of [url, text]) {
    if (!source) continue;
    const idx = source.indexOf('#/');
    if (idx < 0) continue;
    // Trim trailing chars that don't belong to a hash route (whitespace
    // from share-text wrappers, query-string splits like `?utm=...`,
    // etc.) so embedded URLs like
    //   "check https://...#/stop/xyz789 out"
    // still resolve cleanly.
    const rawHash = source.slice(idx);
    const hashEnd = rawHash.search(/[\s?]/);
    const hash = hashEnd < 0 ? rawHash : rawHash.slice(0, hashEnd);
    const stopM = STOP_HASH_RE.exec(hash);
    if (stopM) {
      const id = safeDecode(stopM[1]);
      return {
        kind: 'stop',
        hash: `#/stop/${encodeURIComponent(id)}`,
        id,
      };
    }
    const routeM = ROUTE_HASH_RE.exec(hash);
    if (routeM) {
      const [, co, route, dir, service] = routeM;
      const dec = (s) => safeDecode(s);
      const dCo = dec(co);
      const dRoute = dec(route);
      const dDir = dec(dir);
      const dService = dec(service);
      return {
        kind: 'route',
        hash: `#/route/${encodeURIComponent(dCo)}/${encodeURIComponent(dRoute)}/${encodeURIComponent(dDir)}/${encodeURIComponent(dService)}`,
        co: dCo,
        route: dRoute,
        dir: dDir,
        service: dService,
      };
    }
  }

  // 2. Text as a search query. Flag whether it looks like a route
  //    number so the caller can decide between a free-text search and
  //    a route-number search.
  const t = text.trim();
  if (t) {
    const isRouteNumber = ROUTE_NUMBER_RE.test(t);
    return { kind: 'search', query: t, isRouteNumber };
  }

  // 3. Nothing actionable.
  return { kind: 'none' };
}

/**
 * `decodeURIComponent` is lax — `decodeURIComponent('%E4%B8')` throws
 * URIError on the truncated sequence. Wrap in try/catch so a single
 * malformed hash can't crash the boot path.
 *
 * @param {string} s
 * @returns {string}
 */
function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch (_) {
    return s;
  }
}

// When loaded as a classic script (in index.html before app.js), attach
// the export to globalThis.busetaUtils so app.js can call
// `busetaUtils.parseShareTarget(...)` without an import.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    parseShareTarget,
  });
}
