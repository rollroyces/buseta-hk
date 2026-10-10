import { describe, it, expect } from 'vitest';
import { isDisruptionExpired } from '../../src/utils/disruptions.js';

describe('isDisruptionExpired', () => {
  it('returns false when item is null', () => {
    expect(isDisruptionExpired(null)).toBe(false);
  });

  it('returns false when item is undefined', () => {
    expect(isDisruptionExpired(undefined)).toBe(false);
  });

  it('returns false when item has no `until` field (indefinite)', () => {
    expect(isDisruptionExpired({})).toBe(false);
    expect(isDisruptionExpired({ title: 'permanent closure' })).toBe(false);
  });

  it('returns false when until is non-string', () => {
    expect(isDisruptionExpired({ until: 12345 })).toBe(false);
    expect(isDisruptionExpired({ until: null })).toBe(false);
    expect(isDisruptionExpired({ until: { iso: '2026-10-10' } })).toBe(false);
  });

  it('returns false when until is in the future', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const futureStr = future.toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
    expect(isDisruptionExpired({ until: futureStr })).toBe(false);
  });

  it('returns true when until is in the past', () => {
    const past = new Date();
    past.setDate(past.getDate() - 30);
    const pastStr = past.toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
    expect(isDisruptionExpired({ until: pastStr })).toBe(true);
  });

  it('returns false when until is today (boundary case)', () => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
    expect(isDisruptionExpired({ until: today })).toBe(false);
  });
});
