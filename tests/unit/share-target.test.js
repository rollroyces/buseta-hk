// Tests for src/utils/share-target.js — the share-target query-string
// parser added in Phase 44. Pure function (no DOM, no storage), so
// these tests run in the default Node environment without jsdom.

import { describe, it, expect } from 'vitest';
import { parseShareTarget } from '../../src/utils/share-target.js';

describe('parseShareTarget — string input (location.search shape)', () => {
  it('parses `?text=...&url=...` from a leading `?`', () => {
    const out = parseShareTarget(
      '?text=hello&url=https%3A%2F%2Fbuseta-hk.example%2F%23%2Fstop%2Fabc'
    );
    expect(out.kind).toBe('stop');
    expect(out.id).toBe('abc');
    expect(out.hash).toBe('#/stop/abc');
  });

  it('parses a raw query string without the leading `?`', () => {
    const out = parseShareTarget('text=KMB+10');
    expect(out.kind).toBe('search');
    expect(out.query).toBe('KMB 10');
    expect(out.isRouteNumber).toBe(false);
  });

  it('returns `none` for an empty / malformed input', () => {
    expect(parseShareTarget('').kind).toBe('none');
    expect(parseShareTarget('?').kind).toBe('none');
    expect(parseShareTarget(null).kind).toBe('none');
    expect(parseShareTarget(undefined).kind).toBe('none');
  });
});

describe('parseShareTarget — object input', () => {
  it('returns `none` when both `text` and `url` are missing', () => {
    expect(parseShareTarget({}).kind).toBe('none');
    expect(parseShareTarget({ text: '', url: '' }).kind).toBe('none');
  });

  it('extracts a stop hash from the `url` field', () => {
    const out = parseShareTarget({
      text: '',
      url: 'https://buseta-hk.example/#/stop/abc123',
    });
    expect(out.kind).toBe('stop');
    expect(out.id).toBe('abc123');
    expect(out.hash).toBe('#/stop/abc123');
  });

  it('extracts a route hash from the `url` field', () => {
    const out = parseShareTarget({
      text: '',
      url: 'https://buseta-hk.example/#/route/KMB/10/I/1',
    });
    expect(out.kind).toBe('route');
    expect(out.co).toBe('KMB');
    expect(out.route).toBe('10');
    expect(out.dir).toBe('I');
    expect(out.service).toBe('1');
    expect(out.hash).toBe('#/route/KMB/10/I/1');
  });

  it('extracts a stop hash from the `text` field when `url` lacks one', () => {
    const out = parseShareTarget({
      text: 'check this https://buseta-hk.example/#/stop/xyz789 out',
      url: '',
    });
    expect(out.kind).toBe('stop');
    expect(out.id).toBe('xyz789');
    expect(out.hash).toBe('#/stop/xyz789');
  });

  it('prefers the `url` field hash over a `text`-field hash', () => {
    const out = parseShareTarget({
      text: 'noise https://buseta-hk.example/#/stop/first more noise',
      url: 'https://buseta-hk.example/#/stop/second',
    });
    expect(out.kind).toBe('stop');
    expect(out.id).toBe('second');
  });

  it('falls through to `text` as a free-text search when no hash is present', () => {
    const out = parseShareTarget({ text: 'Central', url: '' });
    expect(out.kind).toBe('search');
    expect(out.query).toBe('Central');
    expect(out.isRouteNumber).toBe(false);
  });

  it('flags `isRouteNumber: true` for KMB-style `286C` numbers', () => {
    const out = parseShareTarget({ text: '286C', url: '' });
    expect(out.kind).toBe('search');
    expect(out.query).toBe('286C');
    expect(out.isRouteNumber).toBe(true);
  });

  it('flags `isRouteNumber: true` for plain digit route numbers', () => {
    const out = parseShareTarget({ text: '10', url: '' });
    expect(out.kind).toBe('search');
    expect(out.query).toBe('10');
    expect(out.isRouteNumber).toBe(true);
  });

  it('flags `isRouteNumber: false` for free-text containing digits', () => {
    const out = parseShareTarget({ text: 'bus 10', url: '' });
    expect(out.kind).toBe('search');
    expect(out.query).toBe('bus 10');
    expect(out.isRouteNumber).toBe(false);
  });

  it('flags `isRouteNumber: false` for lowercase-letter route numbers', () => {
    const out = parseShareTarget({ text: '286c', url: '' });
    expect(out.isRouteNumber).toBe(false);
  });

  it('trims whitespace around the search query', () => {
    const out = parseShareTarget({ text: '  Central  ', url: '' });
    expect(out.query).toBe('Central');
  });

  it('does not crash on a malformed percent-encoded hash', () => {
    const out = parseShareTarget({
      text: '',
      url: 'https://buseta-hk.example/#/stop/%E4%B8',
    });
    // safeDecode catches the URIError — we should get *some* decision,
    // not a thrown exception.
    expect(out).toBeDefined();
    expect(typeof out.kind).toBe('string');
  });
});

describe('parseShareTarget — URLSearchParams input', () => {
  it('accepts a URLSearchParams instance directly', () => {
    const sp = new URLSearchParams('text=Central&url=');
    const out = parseShareTarget(sp);
    expect(out.kind).toBe('search');
    expect(out.query).toBe('Central');
  });

  it('handles URLSearchParams with a stop-hash url', () => {
    const sp = new URLSearchParams();
    sp.set('url', 'https://buseta-hk.example/#/stop/abc');
    sp.set('text', '');
    const out = parseShareTarget(sp);
    expect(out.kind).toBe('stop');
    expect(out.id).toBe('abc');
  });
});
