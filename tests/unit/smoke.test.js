// Smoke tests for the Vitest infrastructure.
// Real unit tests for app.js / planner.js helpers will be added as those
// functions are extracted into importable modules.

import { describe, it, expect } from 'vitest';

describe('vitest infrastructure', () => {
  it('runs basic arithmetic', () => {
    expect(1 + 1).toBe(2);
  });

  it('supports ES module imports', async () => {
    const mod = await import('./_fixture.js');
    expect(mod.double(21)).toBe(42);
  });
});

describe('Intl APIs (used throughout the app)', () => {
  it('formats numbers in en / zh-Hant / zh-Hans', () => {
    const n = 1234567;
    expect(new Intl.NumberFormat('en').format(n)).toBeTruthy();
    expect(new Intl.NumberFormat('zh-Hant').format(n)).toBeTruthy();
    expect(new Intl.NumberFormat('zh-Hans').format(n)).toBeTruthy();
  });

  it('formats dates in Asia/Hong_Kong', () => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Hong_Kong',
      hour: '2-digit',
      minute: '2-digit',
    });
    expect(fmt.format(new Date('2026-10-10T08:00:00Z'))).toMatch(/\d{2}:\d{2}/);
  });

  it('formats relative time (used for "last updated X ago")', () => {
    const rtf = new Intl.RelativeTimeFormat('zh-Hant', { numeric: 'auto' });
    expect(rtf.format(-1, 'minute')).toBeTruthy();
  });
});