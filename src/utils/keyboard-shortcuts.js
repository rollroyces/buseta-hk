// Keyboard-shortcut helpers for BusETA HK (Phase 41).
//
// Two pieces of behaviour live here:
//
//   1. A small chord tracker (two-key sequences like Vim / GitHub-style
//      `g h` to "go home"). Pure timing state — no DOM, no listeners —
//      so it's trivial to unit-test.
//
//   2. A dispatcher factory that wires a `keydown` listener on
//      `document`, suppresses shortcuts while the user is editing text
//      (input / textarea / contenteditable), and routes a curated set
//      of keys to caller-supplied handlers.
//
// Conventions:
//   - `/`            → focus the search input.
//   - `?` (Shift+/)  → open the help modal.
//   - `g <key>`      → two-key chord (g h, g s, g p, g n) for
//                      navigation; 1s timeout, prefix is dropped on
//                      any other key or focus change.
//   - `Escape`       → hand off to the caller (typical use: close a
//                      modal or back-navigate).
//   - `s`            → toggle save for the current route / stop /
//                      station. Suppressed when typing.
//
// All decision making is deterministic so tests can pin every branch:
// no global state outside the returned dispatcher's closure.

const CHORD_TIMEOUT_MS = 1000;

/**
 * Returns true if `el` is a text-editing surface where shortcuts
 * should be suppressed. `contenteditable` elements are detected via
 * the attribute or the `isContentEditable` DOM property (Safari /
 * Edge expose one but not the other in some configurations).
 *
 * @param {Element|null|undefined} el
 * @returns {boolean}
 */
export function isEditableElement(el) {
  if (!el || typeof el !== 'object') return false;
  if (typeof el.isContentEditable === 'boolean' && el.isContentEditable) return true;
  if (el.getAttribute && typeof el.getAttribute === 'function') {
    if (el.getAttribute('contenteditable') === 'true') return true;
    if (el.getAttribute('contenteditable') === 'plaintext-only') return true;
  }
  const tag = (el.tagName || '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    // Most input types take text. Buttons / checkboxes don't accept
    // typing, but typing into them is harmless — we suppress anyway
    // for consistency. Hidden inputs never receive focus so they're
    // harmless. Buttons rendered as <input type="button"> match here
    // too; they don't have keyboard-letter semantics.
    return true;
  }
  return false;
}

/**
 * Two-key chord tracker (e.g. `g h`). Stores a single pending prefix
 * key and a deadline. Exposes `press(key)` which returns the
 * resolved chord key (or the new pending key, or null) and
 * automatically times out idle prefix keys.
 *
 * The object is intentionally tiny — it's a state machine for two
 * states (idle, waiting) keyed by a single letter. We don't reuse
 * keyboard-shortcut libraries because the contract is so narrow.
 *
 * An optional `now` function returns the current monotonic timestamp
 * (defaults to `Date.now`). Tests inject a fake clock here so they
 * don't depend on `vi.useFakeTimers` semantics or on `performance.now`
 * being faked by the host runtime.
 */
export function createChordTracker(timeoutMs = CHORD_TIMEOUT_MS, now) {
  let pending = null; // { key: string, expiresAt: number } | null
  const getNow =
    typeof now === 'function'
      ? now
      : () =>
          typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
  function isExpired(t) {
    return getNow() >= t;
  }
  return {
    /**
     * Submit a key press. Returns one of:
     *   `{ kind: 'prefix', key }`  — first key of a chord; caller
     *                                should wait for the next press.
     *   `{ kind: 'chord', key }`   — second key of a chord was
     *                                pressed while the prefix was
     *                                still armed; resolve via the
     *                                handler map.
     *   `{ kind: 'idle' }`         — no prefix was armed; same
     *                                semantically as a fresh press.
     *
     * @param {string} key  — already lowercased single character.
     */
    press(key) {
      if (pending && !isExpired(pending.expiresAt)) {
        // Pending chord + fresh key → resolve as a chord. We always
        // wipe the prefix; if the new key is itself the start of a
        // chord the caller will re-call arm() with it as a prefix.
        const second = key;
        pending = null;
        return { kind: 'chord', key: second };
      }
      pending = null; // expired or first-time
      return { kind: 'prefix', key };
    },
    /**
     * Mark the prefix key as armed. Call after receiving a 'prefix'
     * result to set the deadline. Subsequent press() calls will then
     * resolve as chords (if within timeout) or fall through.
     */
    arm(key) {
      pending = { key, expiresAt: getNow() + timeoutMs };
    },
    /**
     * Cancel any pending prefix without recording a new press. Use on
     * blur / focus changes so a chord doesn't carry across
     * applications / windows.
     */
    clear() {
      pending = null;
    },
    /** Test / introspection helper — true if a prefix is currently armed. */
    hasPending() {
      return !!pending && !isExpired(pending.expiresAt);
    },
  };
}

/**
 * Build a keyboard-shortcut dispatcher wired to `document.keydown`.
 * The dispatcher ignores keys when the active element is editable so
 * typing into the search box never accidentally triggers `g h` etc.
 *
 * @param {{
 *   onSearch?: (ev: KeyboardEvent) => void,
 *   onGoHome?: (ev: KeyboardEvent) => void,
 *   onGoSaved?: (ev: KeyboardEvent) => void,
 *   onGoPlanner?: (ev: KeyboardEvent) => void,
 *   onGoNearby?: (ev: KeyboardEvent) => void,
 *   onEscape?: (ev: KeyboardEvent) => void,
 *   onSave?: (ev: KeyboardEvent) => void,
 *   onHelp?: (ev: KeyboardEvent) => void,
 * }} handlers
 * @param {{ chordTimeoutMs?: number }} [opts]
 * @returns {{ attach: () => void, detach: () => void }}
 */
export function createKeyboardDispatcher(handlers = {}, opts = {}) {
  // `now` injection lets tests use a fake clock without depending on
  // vitest's `useFakeTimers` behaviour for `performance.now`.
  const chord = createChordTracker(opts.chordTimeoutMs ?? CHORD_TIMEOUT_MS, opts.now);
  let attached = false;
  let onKeyDown = null;

  function handle(ev) {
    if (!ev || typeof ev.key !== 'string') return;
    // Ignore combinations with Ctrl / Alt / Meta so we don't fight
    // browser shortcuts (Cmd+R, Ctrl+L, …). Shift is allowed: `?`
    // requires Shift+/ on most layouts.
    if (ev.ctrlKey || ev.altKey || ev.metaKey) return;
    const target = ev.target;
    const editable = isEditableElement(target);

    const key = ev.key;

    // Always handle Escape, regardless of focus — Escape-from-input
    // is a long-standing pattern (close IME-suggestion, dismiss
    // menus, defocus). Each caller's onEscape decides what to do.
    if (key === 'Escape') {
      chord.clear();
      if (typeof handlers.onEscape === 'function') handlers.onEscape(ev);
      return;
    }

    // `?` is Shift+/ on US / UK layouts. Keep modifier-checked so we
    // don't intercept a plain `/` typed in a layout where it's shift+.
    if (ev.shiftKey && key === '?') {
      chord.clear();
      if (!editable && typeof handlers.onHelp === 'function') handlers.onHelp(ev);
      return;
    }

    // From here on we skip when the user is editing text.
    if (editable) return;

    if (key === '/') {
      chord.clear();
      if (typeof handlers.onSearch === 'function') handlers.onSearch(ev);
      ev.preventDefault();
      return;
    }

    // Two-key chords only — anything else is single-key.
    if (key.length !== 1) return;

    const lower = key.toLowerCase();

    // Chord resolution first. If a `g` prefix is currently armed and
    // the user pressed h/s/p/n, fire the matching handler and cancel
    // the prefix. This runs BEFORE the `s` single-key check so a
    // `g s` sequence resolves as `onGoSaved` rather than `onSave`.
    const CHORD_SECOND = { h: 'onGoHome', s: 'onGoSaved', p: 'onGoPlanner', n: 'onGoNearby' };
    if (chord.hasPending()) {
      chord.clear();
      const handlerName = CHORD_SECOND[lower];
      const fn = handlerName ? handlers[handlerName] : null;
      if (fn && !ev.shiftKey) {
        ev.preventDefault();
        fn(ev);
      }
      // Non-chord second key: silently drop the prefix (browser-style).
      return;
    }

    // `s` is single-key (save). Don't route through the chord tracker.
    if (lower === 's' && !ev.shiftKey) {
      chord.clear();
      if (typeof handlers.onSave === 'function') handlers.onSave(ev);
      return;
    }

    // No pending prefix — start one if this is `g` (without shift).
    if (lower === 'g' && !ev.shiftKey) {
      chord.arm(lower);
      ev.preventDefault();
      return;
    }

    // Anything else without an active prefix: chord does nothing.
  }

  return {
    attach() {
      if (attached || typeof document === 'undefined') return;
      onKeyDown = handle;
      document.addEventListener('keydown', onKeyDown, true);
      attached = true;
    },
    detach() {
      if (!attached || typeof document === 'undefined') return;
      document.removeEventListener('keydown', onKeyDown, true);
      onKeyDown = null;
      attached = false;
      chord.clear();
    },
    /**
     * Test / introspection helper — exposed so callers can re-attach
     * to a different document (rare) and so tests can verify state.
     */
    _chord: chord,
  };
}

// Dual-export pattern (mirrors focus-trap.js): when loaded as a
// classic <script> (index.html), attach the API to globalThis so
// app.js can call `busetaUtils.createKeyboardDispatcher(...)` without
// an import. The ES-module `export`s above are the real surface and
// the unit tests use them.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    isEditableElement,
    createChordTracker,
    createKeyboardDispatcher,
  });
}
