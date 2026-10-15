// Network helpers. Thin wrappers around fetch() that throw on non-OK
// responses and return JSON or text. Identical to app.js:1546 / app.js:1551.
// Phase 4 extraction — the inlined copies will be removed in this PR.

/**
 * Fetch a URL and parse the response as JSON. Throws an Error with the
 * HTTP status code on non-OK responses.
 *
 * @param {string} url - The URL to fetch.
 * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation.
 * @returns {Promise<any>} The parsed JSON response.
 * @throws {Error} If the response status is not OK.
 */
export async function fetchJSON(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Fetch a URL and return the response body as text. Throws an Error with
 * the HTTP status code on non-OK responses.
 *
 * @param {string} url - The URL to fetch.
 * @param {AbortSignal} [signal] - Optional AbortSignal for cancellation.
 * @returns {Promise<string>} The response body as text.
 * @throws {Error} If the response status is not OK.
 */
export async function fetchText(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// When loaded as a classic script (in index.html before app.js), attach
// the exports to globalThis.busetaUtils so app.js / planner.js can call
// them as `busetaUtils.fetchJSON(...)`. Idempotent.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    fetchJSON,
    fetchText,
  });
}
