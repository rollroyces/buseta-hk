# Web Push notifications for service-disruption alerts

> Phase 42 — wires up the browser-side half of a Web Push subscription
> for opt-in service-disruption alerts. Server-side delivery is **not**
> included in this phase; see "What's missing" below.

## What works client-side

The Phase 42 PR ships a complete **client-side** push pipeline:

1. **Settings UI** — a "Service alerts / 服務通知 / 服务通知" section
   lives in the dedicated Settings view (`#/settings`). The toggle
   defaults to OFF.
2. **Permission request** — invoked only when the user taps the
   toggle. `Notification.requestPermission()` is never called on page
   load, from background timers, or from the SW — only from the toggle
   click handler, satisfying the W3C user-gesture requirement.
3. **Subscription handshake** — once permission is `granted`, the app
   calls `busetaUtils.pushSubscribe(vapidPublicKey)` which:
   - Decodes the base64url VAPID public key from
     `assets/config.json` into an `ArrayBuffer`.
   - Calls `pushManager.subscribe({ userVisibleOnly: true,
applicationServerKey })` on the active SW.
   - Returns `{ ok: true, subscription }` where `subscription` is the
     `toJSON()` shape the future server will need.
4. **Subscription storage** — the JSON is written to
   `localStorage.buseta.push.subscription`. The endpoint URL +
   `keys.p256dh` / `keys.auth` are the three fields a server needs.
5. **SW handlers** — `sw.js` now has:
   - `self.addEventListener('push', …)` — parses
     `event.data.json()`, calls `self.registration.showNotification()`
     with `icon/badge: /assets/icon.svg`, `tag`, and the route URL
     bundled in `data.url`.
   - `self.addEventListener('notificationclick', …)` — closes the
     notification, focuses an existing client window (or opens a new
     one with `clients.openWindow(data.url)`).
6. **Feature detection** — if the runtime lacks `PushManager` /
   `serviceWorker` / `Notification` (older Safari, iOS WebView, some
   in-app browsers), the settings section shows
   `pushUnsupported / 此瀏覽器不支援通知功能 / 此浏览器不支援通知功能`
   instead of the toggle.
7. **Denied-state UX** — if the OS-level permission is `denied`, the
   toggle is disabled and a `pushDeniedHint` line points the user at
   browser settings.

The whole pipeline lives in three new files:

- `src/utils/push-subscriptions.js` — pure helpers
  (`parseVapidKey`, `pushSupported`, `pushSubscribe`, `pushUnsubscribe`,
  `getSubscription`).
- `tests/unit/push-subscriptions.test.js` — Vitest coverage for the
  pure decode + the unsupported envelope.
- The render block inside `app.js`'s `renderSettings()`.

## What's missing

Web Push is a **two-party** protocol. The Phase 42 PR ships the
browser side; the server side is intentionally out of scope:

- **No push server.** GitHub Pages is static-only — there's nowhere to
  receive a `/register-subscription` POST or to call `web-push`'s
  `sendNotification()` against the saved endpoint. Until a server
  exists, subscriptions sit in `localStorage` doing nothing. The UI
  surfaces this honestly: when a user opts in, they see the
  `pushNoServer / 通知已就緒，等待伺服器連線` hint instead of a fake
  "you're all set!" promise.
- **No VAPID keypair.** A VAPID keypair has a public half (which goes
  into `assets/config.json` as `vapidPublicKey`) and a private half
  (which lives on the server, **never** in the static bundle).
  Without a keypair there's nothing to authenticate the pushes with.
- **No subscription-to-saved-routes wiring.** A real "service
  disruption on route 1, 2, 9" alert needs to know which routes the
  user has saved — currently the SW just shows whatever payload the
  server pushes. The saved-route index already lives in
  `localStorage.buseta.saved.routes`, so a server-side job can pull
  it; this PR doesn't add the corresponding fetch endpoint.

## How to test (today, without a server)

1. Load the deployed site in Chrome / Edge / Firefox.
2. Navigate to `#/settings`.
3. Scroll to the new "Service alerts / 服務通知" section.
4. Tap the toggle — accept the permission prompt.
5. Open DevTools → Application → Service Workers → click the active
   SW to open its DevTools. Pick the **Push** radio button.
6. Paste this payload:
   ```json
   {
     "title": "路線 1 改道",
     "body": "因路面工程，暫時改經亞皆老街。",
     "tag": "kmb-1",
     "url": "#/route/KMB/1"
   }
   ```
7. Click **Push**. The SW's `push` listener should fire and a
   system-level notification should appear.
8. Click the notification — the SW's `notificationclick` listener
   should focus the existing tab or open a new one pointing at
   `/#/route/KMB/1`.

Verify the SW's `push` handler is wired up even though no real
pushes ever arrive: the `serviceWorker.hasHandler` DevTools flag
will list `push` and `notificationclick` once the new SW is active.

## How to wire a server later

The minimum a future server needs:

1. **VAPID keypair.** Generate one with `web-push generate-vapid-keys`
   (npm) or `openssl`. The public half goes into
   `assets/config.json` as `vapidPublicKey` (base64url-encoded, no
   padding). The private half stays on the server.
2. **Subscription ingest endpoint.** Accept a POST with the JSON in
   `localStorage.buseta.push.subscription`. The three fields you need
   are:
   - `endpoint` — the URL `pushManager.subscribe()` returned. Send
     pushes here.
   - `keys.p256dh` — used to encrypt the payload for this device.
   - `keys.auth` — auth secret for the same encryption.
3. **Push dispatcher.** Use `web-push`'s `sendNotification(subscription,
payload, vapidDetails)`. Pass the matching saved-route list as part
   of `payload` so the SW can filter / tag.
4. **Payload schema** (what the SW expects — see `sw.js`):
   ```ts
   type PushPayload = {
     title: string; // notification header
     body?: string; // optional sub-line
     tag?: string; // collapses repeats with the same tag
     url?: string; // opened on notificationclick; defaults to '/'
   };
   ```
   Stringify with `JSON.stringify(...)` before passing to
   `sendNotification()` — the SW reads it via `event.data.json()`.

That's the entire contract. The Phase 42 PR was deliberately scoped
to the client so the static-site deploy stays static; adding the
server half belongs in a future PR with its own cache-buster bump.
