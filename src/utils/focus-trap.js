// Minimal focus-trap helper for in-page modal dialogs.
//
// A "focus trap" is the standard a11y pattern for modal dialogs:
//   1. When the modal opens, focus moves to a focusable element inside
//      it (typically the first one in tab order, or a designated
//      "primary" action).
//   2. While the modal is open, Tab / Shift+Tab cycle through focusable
//      descendants only — never escape to the page behind.
//   3. When the modal closes, focus returns to the element that opened
//      it (so a keyboard user doesn't lose their place).
//
// We expose a `createFocusTrap(modalEl, opts)` factory that returns
// `{ activate(), deactivate() }`. The factory is decoupled from the
// modal's lifecycle — caller decides when to call activate/deactivate
// (typically inside the modal's open/close handlers).
//
// Pure DOM API. No framework, no listeners-once state outside the
// returned object. Safe to call `activate()` repeatedly — subsequent
// activations just refresh the focusable list and refocus the primary
// element.
//
// Selector list mirrors `:focus-visible` heuristics: visible, enabled,
// non-`display:none`, non-`visibility:hidden`, and inside the modal.
// Elements with `tabindex="-1"` are skipped (programmable but not in
// the tab order) so we don't trap focus on a heading.

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Return the focusable descendants of `root` in DOM order. Hidden
 * elements (`display: none`, `visibility: hidden`, `aria-hidden`)
 * are filtered out so the trap doesn't try to focus something the
 * user can't see.
 *
 * @param {Element} root
 * @returns {Element[]}
 */
export function getFocusableElements(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const all = root.querySelectorAll(FOCUSABLE_SELECTOR);
  const out = [];
  for (const el of all) {
    if (el.disabled) continue;
    // Skip elements the user can't see. We check `display` + `visibility`
    // via getComputedStyle rather than `offsetParent === null` because
    // the latter is unreliable in jsdom (no layout computation) and is
    // also false-positive for `position: fixed` elements.
    const cs = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
    if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    out.push(el);
  }
  return out;
}

/**
 * Create a focus trap for `modalEl`. Returns `{ activate, deactivate }`.
 *
 * @param {Element} modalEl - The modal/dialog root element.
 * @param {{ initialFocus?: Element | (() => Element), returnFocus?: Element }} [opts]
 *   - `initialFocus`: Element (or function returning Element) to focus
 *     when activate() is called. Defaults to the first focusable
 *     descendant of `modalEl`.
 *   - `returnFocus`: Element to restore focus to when deactivate() is
 *     called. Defaults to whatever was focused just before activate()
 *     was called.
 * @returns {{ activate: () => void, deactivate: () => void }}
 */
export function createFocusTrap(modalEl, opts = {}) {
  if (!modalEl) throw new Error('createFocusTrap: modalEl is required');
  const providedReturn = opts.returnFocus || null;
  let previouslyFocused = null;
  let onKeyDown = null;

  function pickInitial() {
    if (typeof opts.initialFocus === 'function') return opts.initialFocus();
    if (opts.initialFocus) return opts.initialFocus;
    const list = getFocusableElements(modalEl);
    return list[0] || modalEl;
  }

  function handleKey(ev) {
    if (ev.key !== 'Tab') return;
    const focusables = getFocusableElements(modalEl);
    if (focusables.length === 0) {
      // No focusables at all — block Tab so focus stays on the modal.
      ev.preventDefault();
      modalEl.focus({ preventScroll: true });
      return;
    }
    const idx = focusables.indexOf(document.activeElement);
    if (ev.shiftKey) {
      if (idx <= 0) {
        ev.preventDefault();
        focusables[focusables.length - 1].focus();
      }
    } else {
      if (idx === -1 || idx === focusables.length - 1) {
        ev.preventDefault();
        focusables[0].focus();
      }
    }
  }

  return {
    activate() {
      previouslyFocused = providedReturn || document.activeElement;
      onKeyDown = handleKey;
      document.addEventListener('keydown', onKeyDown, true);
      // Focus the initial element. Microtask (Promise.resolve().then)
      // is more reliable than requestAnimationFrame in jsdom-based
      // tests while still being fast enough in production (focus
      // happens on the next tick of the event loop, before paint).
      const focusInitial = () => {
        const fresh = pickInitial();
        if (fresh && typeof fresh.focus === 'function') {
          fresh.focus({ preventScroll: true });
        }
      };
      // Try synchronously first — covers the common case where the
      // modal's DOM is already laid out by the time activate() runs.
      try {
        focusInitial();
      } catch (_) {
        /* defer to microtask below if sync fails */
      }
      // Microtask fallback: re-resolve in case the focusable list
      // changed since we captured the initial (e.g. async QR render).
      Promise.resolve().then(focusInitial);
    },
    deactivate() {
      if (onKeyDown) {
        document.removeEventListener('keydown', onKeyDown, true);
        onKeyDown = null;
      }
      const returnTo = previouslyFocused;
      previouslyFocused = null;
      if (returnTo && typeof returnTo.focus === 'function') {
        // Don't steal focus if the user has already moved on (e.g.
        // clicked another button). Only restore focus if the active
        // element is still inside the modal we're closing.
        if (modalEl.contains(document.activeElement) || document.activeElement === document.body) {
          returnTo.focus({ preventScroll: true });
        }
      }
    },
  };
}

// When loaded as a classic script (in index.html before app.js), attach
// the exports to globalThis.busetaUtils.
if (typeof globalThis !== 'undefined') {
  globalThis.busetaUtils = Object.assign(globalThis.busetaUtils || {}, {
    getFocusableElements,
    createFocusTrap,
  });
}
