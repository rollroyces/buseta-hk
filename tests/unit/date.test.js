import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseTdDate, hktToday, addDays } from '../../src/utils/date.js';

describe('parseTdDate', () => {
  it('parses a standard DD.MM.YYYY string', () => {
    expect(parseTdDate('25.12.2024')).toBe('2024-12-25');
  });

  it('zero-pads single-digit day and month', () => {
    expect(parseTdDate('1.3.2024')).toBe('2024-03-01');
  });

  it('trims surrounding whitespace', () => {
    expect(parseTdDate('  25.12.2024  ')).toBe('2024-12-25');
  });

  it('returns "" for non-string inputs', () => {
    expect(parseTdDate(null)).toBe('');
    expect(parseTdDate(undefined)).toBe('');
    expect(parseTdDate(20241225)).toBe('');
    expect(parseTdDate({})).toBe('');
    expect(parseTdDate([])).toBe('');
  });

  it('returns "" for malformed strings', () => {
    expect(parseTdDate('25/12/2024')).toBe(''); // wrong separator
    expect(parseTdDate('25.12.24')).toBe(''); // 2-digit year
    expect(parseTdDate('2024-12-25')).toBe(''); // ISO order
    expect(parseTdDate('hello')).toBe('');
    expect(parseTdDate('')).toBe('');
  });

  it('returns "" for out-of-range day or month', () => {
    expect(parseTdDate('00.12.2024')).toBe(''); // day 0
    expect(parseTdDate('32.12.2024')).toBe(''); // day 32
    expect(parseTdDate('25.00.2024')).toBe(''); // month 0
    expect(parseTdDate('25.13.2024')).toBe(''); // month 13
  });
});

describe('hktToday', () => {
  it('returns a YYYY-MM-DD string', () => {
    const s = hktToday();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to UTC when Intl throws', () => {
    // Force the Intl branch to throw.
    const original = Date.prototype.toLocaleDateString;
    Date.prototype.toLocaleDateString = function () {
      throw new Error('forced');
    };
    try {
      const s = hktToday();
      expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    } finally {
      Date.prototype.toLocaleDateString = original;
    }
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    expect(addDays('2024-01-31', 1)).toBe('2024-02-01');
    expect(addDays('2024-02-28', 3)).toBe('2024-03-02'); // crosses March
  });

  it('adds negative days (subtracts)', () => {
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29'); // 2024 is leap
    expect(addDays('2024-01-01', -1)).toBe('2023-12-31');
  });

  it('handles zero (no change)', () => {
    expect(addDays('2024-06-15', 0)).toBe('2024-06-15');
  });

  it('returns the input string on parse failure', () => {
    expect(addDays('not a date', 5)).toBe('not a date');
    expect(addDays('', 5)).toBe('');
    expect(addDays(null, 5)).toBe('');
    expect(addDays(undefined, 5)).toBe('');
  });

  it('handles year rollover', () => {
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2023-12-31', 366)).toBe('2024-12-31'); // 2024 is leap
  });

  it('zero-pads month and day', () => {
    // addDays output should always be YYYY-MM-DD, two-digit M and D.
    expect(addDays('2024-01-01', 30)).toBe('2024-01-31');
    expect(addDays('2024-01-01', 31)).toBe('2024-02-01');
  });
});
