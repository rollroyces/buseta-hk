// Tests for src/utils/push-subscriptions.js — the Web Push subscription
// helpers. The source guards every browser API with `typeof` checks
// (returning the "unsupported" envelope when `navigator`, `PushManager`,
// or `Notification` is undefined), so the tests run fine in the default
// Node environment without jsdom. We verify the "unsupported" branch
// (which is what Node + CI runners will always hit) and the pure decode
// helper. A real browser would exercise the same logic against actual
// PushManager / Notification globals.

import { describe, it, expect } from 'vitest';
import {
  parseVapidKey,
  pushSupported,
  pushSubscribe,
  pushUnsubscribe,
  getSubscription,
} from '../../src/utils/push-subscriptions.js';

// 32 base64url chars decode to 24 bytes — a reasonable VAPID key shape
// (real VAPID public keys are 32 bytes raw → 43 base64url chars
// unpadded; we trim to 32 to avoid having to count padding here).
// Using the simple alphabet: 'A' = 0, 'B' = 1, …
// We avoid hand-computing the decoded byte values (the base64 → bytes
// mapping is fiddly when the bytes straddle char boundaries) and just
// round-trip through an externally-computed string: encode a known
// byte sequence, assert it decodes back.
const VALID_KEY_B64URL = 'AABA' + 'B'.repeat(28); // 32 chars, no padding

describe('parseVapidKey', () => {
  it('returns null for null / undefined / non-string input', () => {
    expect(parseVapidKey(null)).toBeNull();
    expect(parseVapidKey(undefined)).toBeNull();
    expect(parseVapidKey(123)).toBeNull();
    expect(parseVapidKey({})).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseVapidKey('')).toBeNull();
  });

  it('returns null for a string containing non-base64 chars', () => {
    // '!' is not a base64 alphabet character and atob() rejects it.
    expect(parseVapidKey('!!!!')).toBeNull();
  });

  it('decodes a valid base64url string into an ArrayBuffer', () => {
    // 32 base64url chars (no padding) decode to 24 raw bytes — the
    // expected VAPID-public-key length for `applicationServerKey`
    // (the spec allows 65 bytes for P-256, but most tooling strips
    // the leading 0x04 uncompressed point indicator to land on 64;
    // 24 is a fine shape to verify the decode pipeline).
    const out = parseVapidKey(VALID_KEY_B64URL);
    expect(out).not.toBeNull();
    expect(out).toBeInstanceOf(ArrayBuffer);
    const bytes = new Uint8Array(out);
    expect(bytes.length).toBe(24);
    // Leading 'A' = 6 zero bits, so the first byte is 0x00.
    expect(bytes[0]).toBe(0x00);
  });

  it('round-trips a known byte sequence via base64url', () => {
    // Encode [0x01, 0x02, 0x03] as base64url (no padding):
    //   0x01 0x02 0x03 → 24 bits → 000000 010000 001000 000011
    //                  → 'AQID' (standard base64 = 'AQID')
    //                  → 'AQID' (base64url: same, since no +/= chars).
    const out = parseVapidKey('AQID');
    expect(out).not.toBeNull();
    expect(new Uint8Array(out)).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
  });

  it('adds padding back when the base64url string is unpadded', () => {
    // 'AQ' decodes to [0x01] — one byte, no padding needed; check it
    // round-trips cleanly. (atob() rejects un-padded strings.)
    expect(parseVapidKey('AQ')).toBeInstanceOf(ArrayBuffer);
    const bytes = new Uint8Array(parseVapidKey('AQ'));
    expect(bytes.length).toBe(1);
    expect(bytes[0]).toBe(0x01);
  });

  it('handles base64url chars (- and _) by swapping them back', () => {
    // Two-byte sequences:
    //   base64:    '+' = 62, '/' = 63  → bytes 0xff, 0xff
    //   base64url: '-' = 62, '_' = 63  → same bytes when swapped.
    // A 4-char unpadded url-encoded "7777" decodes to 3 bytes; we
    // verify the swap works by encoding the same bytes via two
    // different alphabets and asserting equal output.
    const viaPlus = parseVapidKey('+/+/');
    const viaDash = parseVapidKey('-_-_');
    expect(viaPlus).not.toBeNull();
    expect(viaDash).not.toBeNull();
    expect(new Uint8Array(viaPlus)).toEqual(new Uint8Array(viaDash));
  });
});

describe('pushSupported', () => {
  // jsdom exposes a `navigator.serviceWorker` stub but no `PushManager`.
  it('returns false in jsdom (no PushManager)', () => {
    // jsdom ships `serviceWorker` on navigator but lacks the
    // PushManager global — `pushSupported()` should bail out.
    expect(typeof navigator).toBe('object');
    expect(pushSupported()).toBe(false);
  });
});

describe('pushSubscribe (jsdom — unsupported path)', () => {
  it('returns { ok: false, reason: "unsupported" } when PushManager is missing', async () => {
    const out = await pushSubscribe(VALID_KEY_B64URL);
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('unsupported');
  });

  it('returns the same envelope for an empty / missing VAPID key', async () => {
    // The "unsupported" short-circuit fires before the key check, so
    // even an invalid key yields the same envelope.
    const out = await pushSubscribe('');
    expect(out).toEqual({ ok: false, reason: 'unsupported' });
    const out2 = await pushSubscribe(null);
    expect(out2).toEqual({ ok: false, reason: 'unsupported' });
  });
});

describe('pushUnsubscribe (jsdom — unsupported path)', () => {
  it('returns { ok: false, reason: "unsupported" } when PushManager is missing', async () => {
    const out = await pushUnsubscribe();
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('unsupported');
  });
});

describe('getSubscription (jsdom — unsupported path)', () => {
  it('returns null when PushManager is missing', async () => {
    const out = await getSubscription();
    expect(out).toBeNull();
  });
});
