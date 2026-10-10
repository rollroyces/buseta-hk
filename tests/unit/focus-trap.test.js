// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getFocusableElements, createFocusTrap } from '../../src/utils/focus-trap.js';

// Shared registry so afterEach can deactivate every trap any test
// created — otherwise leaked listeners from earlier tests fire on the
// current test's keydown events and pollute expectations (the handlers
// are attached to `document`, which is shared across tests).
const ACTIVE_TRAPS = new Set();

function trackedTrap(modalEl, opts) {
  const trap = createFocusTrap(modalEl, opts);
  const origActivate = trap.activate;
  const origDeactivate = trap.deactivate;
  trap.activate = function trackedActivate() {
    origActivate();
    ACTIVE_TRAPS.add(trap);
    return trap;
  };
  trap.deactivate = function trackedDeactivate() {
    ACTIVE_TRAPS.delete(trap);
    return origDeactivate();
  };
  return trap;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  // Tear down any trap that the current test forgot to deactivate.
  for (const trap of Array.from(ACTIVE_TRAPS)) {
    trap.deactivate();
  }
  ACTIVE_TRAPS.clear();
});

// Tiny helper: build a modal with the standard mix of focusable +
// non-focusable children we see in the QR modal (close button, title,
// image, URL text).
function makeModal() {
  const wrap = document.createElement('div');
  wrap.className = 'qr-modal';
  wrap.setAttribute('role', 'dialog');
  const card = document.createElement('div');
  card.className = 'qr-modal-card';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'qr-modal-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';
  const title = document.createElement('p');
  title.className = 'qr-modal-title';
  title.textContent = 'Share';
  const img = document.createElement('div');
  img.className = 'qr-modal-img';
  const url = document.createElement('p');
  url.className = 'qr-modal-url';
  url.textContent = 'https://example.com';
  card.append(close, title, img, url);
  wrap.appendChild(card);
  document.body.appendChild(wrap);
  return wrap;
}

describe('getFocusableElements', () => {
  it('returns an empty array for an empty subtree', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    expect(getFocusableElements(root)).toEqual([]);
  });

  it('returns null / undefined input as an empty array', () => {
    expect(getFocusableElements(null)).toEqual([]);
    expect(getFocusableElements(undefined)).toEqual([]);
  });

  it('picks up a, button, input, select, textarea, [tabindex]', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <a href="#">link</a>
      <button>btn</button>
      <input type="text" />
      <select><option>x</option></select>
      <textarea></textarea>
      <div tabindex="0">focusable</div>
    `;
    document.body.appendChild(root);
    const focusables = getFocusableElements(root);
    expect(focusables.length).toBe(6);
    expect(focusables[0].tagName).toBe('A');
    expect(focusables[1].tagName).toBe('BUTTON');
    expect(focusables[2].tagName).toBe('INPUT');
    expect(focusables[3].tagName).toBe('SELECT');
    expect(focusables[4].tagName).toBe('TEXTAREA');
    expect(focusables[5].tagName).toBe('DIV');
  });

  it('excludes disabled form controls', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button>enabled</button>
      <button disabled>disabled</button>
      <input type="text" disabled />
      <input type="text" />
    `;
    document.body.appendChild(root);
    const focusables = getFocusableElements(root);
    expect(focusables.length).toBe(2);
    expect(focusables[0].textContent).toBe('enabled');
  });

  it('excludes tabindex="-1"', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div tabindex="0">focusable</div>
      <div tabindex="-1">programmatic only</div>
    `;
    document.body.appendChild(root);
    const focusables = getFocusableElements(root);
    expect(focusables.length).toBe(1);
    expect(focusables[0].textContent).toBe('focusable');
  });

  it('excludes hidden inputs', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <input type="hidden" />
      <input type="text" />
    `;
    document.body.appendChild(root);
    const focusables = getFocusableElements(root);
    expect(focusables.length).toBe(1);
    expect(focusables[0].type).toBe('text');
  });

  it('excludes aria-hidden elements', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button>visible</button>
      <button aria-hidden="true">hidden</button>
    `;
    document.body.appendChild(root);
    const focusables = getFocusableElements(root);
    expect(focusables.length).toBe(1);
  });

  it('preserves DOM order', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button>a</button>
      <a href="#">b</a>
      <button>c</button>
    `;
    document.body.appendChild(root);
    const focusables = getFocusableElements(root);
    expect(focusables.map((el) => el.textContent)).toEqual(['a', 'b', 'c']);
  });

  it('excludes display:none + visibility:hidden via computed style', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button class="ok">ok</button>
      <button class="dn" style="display: none">dn</button>
      <button class="vh" style="visibility: hidden">vh</button>
    `;
    document.body.appendChild(root);
    const focusables = getFocusableElements(root);
    expect(focusables.length).toBe(1);
    expect(focusables[0].className).toBe('ok');
  });
});

describe('createFocusTrap', () => {
  it('throws on missing modal element', () => {
    expect(() => createFocusTrap(null)).toThrow();
  });

  it('returns activate / deactivate functions', () => {
    const modal = makeModal();
    const trap = trackedTrap(modal);
    expect(typeof trap.activate).toBe('function');
    expect(typeof trap.deactivate).toBe('function');
    trap.deactivate();
  });

  it('activate moves focus to the first focusable descendant', async () => {
    const modal = makeModal();
    const trap = trackedTrap(modal);
    trap.activate();
    // Microtask in implementation runs before the next await.
    await Promise.resolve();
    expect(document.activeElement.className).toBe('qr-modal-close');
    trap.deactivate();
  });

  it('honours initialFocus option', async () => {
    const modal = makeModal();
    // Add a second focusable so we have a non-default target.
    const extra = document.createElement('button');
    extra.className = 'qr-modal-extra';
    extra.textContent = 'extra';
    modal.querySelector('.qr-modal-card').appendChild(extra);
    const trap = trackedTrap(modal, {
      initialFocus: () => modal.querySelector('.qr-modal-extra'),
    });
    trap.activate();
    await Promise.resolve();
    expect(document.activeElement.className).toBe('qr-modal-extra');
    trap.deactivate();
  });

  it('Tab on the last focusable wraps to the first', async () => {
    const modal = makeModal();
    const trap = trackedTrap(modal);
    trap.activate();
    await Promise.resolve();
    const close = modal.querySelector('.qr-modal-close');
    close.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    close.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close); // only one focusable — wraps to itself
    trap.deactivate();
  });

  it('Shift+Tab on the first focusable wraps to the last', async () => {
    const modal = makeModal();
    const trap = trackedTrap(modal);
    trap.activate();
    await Promise.resolve();
    const close = modal.querySelector('.qr-modal-close');
    close.focus();
    const ev = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    close.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
    trap.deactivate();
  });

  it('non-Tab keys are ignored', async () => {
    const modal = makeModal();
    const trap = trackedTrap(modal);
    trap.activate();
    await Promise.resolve();
    const close = modal.querySelector('.qr-modal-close');
    close.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    close.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    trap.deactivate();
  });

  it('deactivate removes the keydown listener', async () => {
    const modal = makeModal();
    const trap = trackedTrap(modal);
    trap.activate();
    trap.deactivate();
    const close = modal.querySelector('.qr-modal-close');
    close.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    close.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('deactivate restores focus to the previously-focused element', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'open';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const modal = makeModal();
    const trap = trackedTrap(modal);
    trap.activate();
    await Promise.resolve();
    expect(document.activeElement.className).toBe('qr-modal-close');

    trap.deactivate();
    expect(document.activeElement).toBe(trigger);
  });

  it('deactivate is idempotent (safe to call twice)', () => {
    const modal = makeModal();
    const trap = trackedTrap(modal);
    trap.activate();
    expect(() => trap.deactivate()).not.toThrow();
    expect(() => trap.deactivate()).not.toThrow();
  });

  it('with multiple focusables, Tab from last wraps to first', async () => {
    const modal = makeModal();
    // Add two more focusables so we can verify wrap behavior.
    const close = modal.querySelector('.qr-modal-close');
    const second = document.createElement('button');
    second.className = 'extra';
    second.textContent = 'two';
    close.parentElement.appendChild(second);
    const third = document.createElement('button');
    third.className = 'extra2';
    third.textContent = 'three';
    close.parentElement.appendChild(third);

    const trap = trackedTrap(modal);
    trap.activate();
    await Promise.resolve();
    third.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    third.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement.className).toBe('qr-modal-close'); // back to first
    trap.deactivate();
  });
});
