// Phase 42 — Web Push subscription helpers.
//
// The browser-side of a push-subscription handshake:
//
//   1. Confirm the runtime exposes `PushManager`.
//   2. Decode the VAPID public key (base64url → ArrayBuffer) so the
//      browser accepts it in `pushManager.subscribe()`.
//   3. Call `pushManager.subscribe({ userVisibleOnly: true,
//                                  applicationServerKey })`.
//   4. Serialise the returned subscription via `subscription.toJSON()`
//      — that's the shape the future server will need to deliver
//      pushes to this device.
//
// None of the helpers throw — they return a `{ ok, ... }` envelope so
// the caller can branch on the reason (e.g. snap the toggle back to
// OFF when the browser denies permission) without an extra try/catch.
//
// We deliberately do NOT request Notification permission from here.
// The W3C spec calls for a user gesture to gate `requestPermission()`,
// and the call site (the settings view's toggle click handler) already
// runs inside a click handler, which satisfies the requirement. The
// caller must obtain permission first via `Notification.requestPermission()`
// before invoking `pushSubscribe()`.

// ------------------------------------------------------------------
// VAPID key decoding
// ------------------------------------------------------------------

/**
 * Decode a VAPID public key from the base64url string the server
 * hands us into the ArrayBuffer that `pushManager.subscribe()`
 * expects in `applicationServerKey`.
 *
 * VAPID keys are shipped as base64url — base64 with `-`/`_` swapped
 * for `+`/`/` and padding stripped. We swap the alphabet back, add
 * the padding back, then `atob()` to get an `Uint8Array`-backed
 * `ArrayBuffer`.
 *
 * Returns `null` on any decode failure (missing input, wrong type,
 * non-base64 chars) so the caller can surface a "no-vapid-key" hint
 * instead of crashing the settings UI.
 *
 * @param {string} vapidKey - The base64url-encoded VAPID public key.
 * @returns {ArrayBuffer | null} The decoded key, or null on failure.
 */
export function parseVapidKey(vapidKey) {
  if (!vapidKey || typeof vapidKey !== 'string') return null;
  try {
    const swapped = vapidKey.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = swapped.length % 4;
    const padded = padLen ? swapped + '='.repeat(4 - padLen) : swapped;
    const binStr = atob(padded);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    return bytes.buffer;
  } catch (_) {
    return null;
  }
}

// ------------------------------------------------------------------
// Feature detection
// ------------------------------------------------------------------

/**
 * Return true iff the runtime exposes a usable `PushManager`. Browsers
 * without one — older Safari, iOS WebView, some in-app browsers —
 * return false so the settings UI can hide the toggle and surface an
 * "unsupported" note instead.
 *
 * @returns {boolean}
 */
export function pushSupported() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  if (typeof PushManager === 'undefined') return false;
  if (typeof Notification === 'undefined') return false;
  return true;
}

// ------------------------------------------------------------------
// Subscribe / unsubscribe
// ------------------------------------------------------------------

/**
 * Subscribe the active SW to push notifications using the given VAPID
 * public key. Returns one of:
 *
 *   - `{ ok: true, subscription }` — the subscription serialised via
 *     `subscription.toJSON()`. The shape the future server needs.
 *   - `{ ok: false, reason: 'unsupported' }` — runtime lacks
 *     `PushManager` / Notification / service worker.
 *   - `{ ok: false, reason: 'denied' }` — Notification permission is
 *     not `granted`. The caller forgot to obtain it via
 *     `Notification.requestPermission()` first.
 *   - `{ ok: false, reason: 'no-vapid-key' }` — `parseVapidKey()`
 *     returned null (empty, wrong shape, decode failure).
 *   - `{ ok: false, reason: 'no-active-sw' }` — no service worker
 *     registration is reachable (SW not installed yet, or the SW
 *     script crashed during install).
 *   - `{ ok: false, reason: 'network-error' }` — the browser-side
 *     subscription handshake threw (network, permissions, etc.).
 *
 * If a subscription already exists on the registration, this returns
 * it as-is rather than re-subscribing — saving a round-trip and
 * keeping the same endpoint on the server side.
 *
 * @param {string} vapidKey - base64url VAPID public key from config.
 * @returns {Promise<{ ok: boolean, subscription?: any, reason?: string }>}
 */
export async function pushSubscribe(vapidKey) {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  if (Notification.permission !== 'granted') return { ok: false, reason: 'denied' };
  const key = parseVapidKey(vapidKey);
  if (!key) return { ok: false, reason: 'no-vapid-key' };
  let reg;
  try {
    reg = await navigator.serviceWorker.ready;
  } catch (_) {
    return { ok: false, reason: 'no-active-sw' };
  }
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
    }
    const json = typeof sub.toJSON === 'function' ? sub.toJSON() : sub;
    return { ok: true, subscription: json };
  } catch (_) {
    return { ok: false, reason: 'network-error' };
  }
}

/**
 * Unsubscribe from push on the active SW. Returns:
 *   - `{ ok: true }` on success — including the no-op case where
 *     there was no active subscription to begin with.
 *   - `{ ok: false, reason: 'unsupported' | 'no-active-sw' |
 *                            'network-error' }` on failure.
 *
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function pushUnsubscribe() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  let reg;
  try {
    reg = await navigator.serviceWorker.ready;
  } catch (_) {
    return { ok: false, reason: 'no-active-sw' };
  }
  try {
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    return { ok: true };
  } catch (_) {
    return { ok: false, reason: 'network-error' };
  }
}

/**
 * Return the active SW's current push subscription (serialised via
 * `toJSON()`), or `null` if there isn't one / feature unsupported /
 * the registration isn't ready.
 *
 * Read-only — does not subscribe or unsubscribe. Useful for the
 * settings view to render the toggle's initial state without going
 * through the full subscribe handshake.
 *
 * @returns {Promise<object | null>}
 */
export async function getSubscription() {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? (typeof sub.toJSON === 'function' ? sub.toJSON() : sub) : null;
  } catch (_) {
    return null;
  }
}

// ------------------------------------------------------------------
// Dual-export — every src/utils/ module attaches itself to
// globalThis.busetaUtils so in-browser classic-script callers can
// invoke `busetaUtils.pushSubscribe(...)` without an import.
// ------------------------------------------------------------------
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    parseVapidKey,
    pushSupported,
    pushSubscribe,
    pushUnsubscribe,
    getSubscription,
  });
}
