// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  summariseSoon,
  buildStopViewSummary,
  SUMMARY_WINDOW_MIN,
} from '../../src/utils/stop-view-summary.js';

describe('summariseSoon', () => {
  it('returns count=0 and soonest=Infinity for null / undefined input', () => {
    expect(summariseSoon(null)).toEqual({ count: 0, soonestMinutes: Infinity });
    expect(summariseSoon(undefined)).toEqual({ count: 0, soonestMinutes: Infinity });
  });

  it('returns count=0 for an empty routes array', () => {
    expect(summariseSoon([])).toEqual({ count: 0, soonestMinutes: Infinity });
  });

  it('returns count=0 when no routes have arrivals', () => {
    expect(summariseSoon([{ arrivals: [] }, { arrivals: null }])).toEqual({
      count: 0,
      soonestMinutes: Infinity,
    });
  });

  it('counts buses arriving within the window', () => {
    const out = summariseSoon([{ arrivals: [{ minutes: 3 }, { minutes: 12 }, { minutes: 25 }] }]);
    expect(out.count).toBe(3);
    expect(out.soonestMinutes).toBe(3);
  });

  it('excludes buses arriving later than the window', () => {
    const out = summariseSoon([{ arrivals: [{ minutes: 5 }, { minutes: 45 }, { minutes: 90 }] }]);
    expect(out.count).toBe(1);
    expect(out.soonestMinutes).toBe(5);
  });

  it('excludes buses with null / 0 / negative minutes', () => {
    const out = summariseSoon([
      { arrivals: [{ minutes: null }, { minutes: 0 }, { minutes: -1 }, { minutes: 5 }] },
    ]);
    expect(out.count).toBe(1);
    expect(out.soonestMinutes).toBe(5);
  });

  it('picks the soonest across multiple routes', () => {
    const out = summariseSoon([
      { arrivals: [{ minutes: 20 }, { minutes: 25 }] },
      { arrivals: [{ minutes: 3 }, { minutes: 8 }] },
      { arrivals: [{ minutes: 15 }] },
    ]);
    expect(out.count).toBe(5);
    expect(out.soonestMinutes).toBe(3);
  });

  it('boundary: 30 minutes is included', () => {
    const out = summariseSoon([{ arrivals: [{ minutes: SUMMARY_WINDOW_MIN }] }]);
    expect(out.count).toBe(1);
    expect(out.soonestMinutes).toBe(30);
  });

  it('boundary: 31 minutes is excluded', () => {
    const out = summariseSoon([{ arrivals: [{ minutes: SUMMARY_WINDOW_MIN + 1 }] }]);
    expect(out.count).toBe(0);
  });
});

describe('buildStopViewSummary', () => {
  // Minimal t_str fixture — only the keys the helper uses. Some entries
  // are functions (etaCount takes a count argument), others are plain
  // strings (minShort is a static label).
  const t_str = (key, ...args) => {
    const store = {
      etaCount: (n) => (n === 1 ? `${n} bus away` : `${n} buses away`),
      minShort: 'min',
    };
    const v = store[key];
    if (typeof v === 'function') return v(...args);
    return v != null ? v : key;
  };

  it('returns "" when summary has count=0', () => {
    expect(buildStopViewSummary({ count: 0, soonestMinutes: Infinity }, t_str)).toBe('');
    expect(buildStopViewSummary(null, t_str)).toBe('');
  });

  it('formats the English summary with soonest minute', () => {
    expect(buildStopViewSummary({ count: 5, soonestMinutes: 3 }, t_str)).toBe(
      '5 buses away, 3 min'
    );
  });

  it('singularises correctly for count=1', () => {
    expect(buildStopViewSummary({ count: 1, soonestMinutes: 5 }, t_str)).toBe('1 bus away, 5 min');
  });

  it('handles soonest === 1 specially (still uses min label)', () => {
    // Edge case: 1 bus arriving in exactly 1 minute. Pluralisation
    // doesn't apply to the minute word; the formatter just emits "1 min".
    expect(buildStopViewSummary({ count: 1, soonestMinutes: 1 }, t_str)).toBe('1 bus away, 1 min');
  });

  it('integrates with summariseSoon for end-to-end use', () => {
    const routes = [
      { arrivals: [{ minutes: 2 }, { minutes: 5 }] },
      { arrivals: [{ minutes: 8 }] },
      { arrivals: [{ minutes: 45 }] }, // out of window
    ];
    const summary = summariseSoon(routes);
    expect(buildStopViewSummary(summary, t_str)).toBe('3 buses away, 2 min');
  });
});
