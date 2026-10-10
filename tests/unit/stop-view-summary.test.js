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
  // Minimal t_str fixture — Phase 18 moved from `etaCount + minShort`
  // composition to a dedicated `ariaSummary(count, mins)` formatter so
  // the phrasing is grammar-correct per language.
  const t_str = (key, ...args) => {
    const store = {
      ariaSummary: (count, mins) => `${count} buses arriving in the next ${mins} minutes`,
    };
    const v = store[key];
    if (typeof v === 'function') return v(...args);
    return v != null ? v : key;
  };

  it('returns "" when summary has count=0', () => {
    expect(buildStopViewSummary({ count: 0, soonestMinutes: Infinity }, t_str)).toBe('');
    expect(buildStopViewSummary(null, t_str)).toBe('');
  });

  it('formats the English summary via ariaSummary(count, mins)', () => {
    expect(buildStopViewSummary({ count: 5, soonestMinutes: 3 }, t_str)).toBe(
      '5 buses arriving in the next 3 minutes'
    );
  });

  it('integrates with summariseSoon for end-to-end use', () => {
    const routes = [
      { arrivals: [{ minutes: 2 }, { minutes: 5 }] },
      { arrivals: [{ minutes: 8 }] },
      { arrivals: [{ minutes: 45 }] }, // out of window
    ];
    const summary = summariseSoon(routes);
    expect(buildStopViewSummary(summary, t_str)).toBe('3 buses arriving in the next 2 minutes');
  });

  it('a custom ariaSummary formatter receives both args', () => {
    const customT = (key, ...args) => {
      if (key === 'ariaSummary') {
        const [count, mins] = args;
        return `${count} buses · fastest in ${mins} min`;
      }
      return key;
    };
    expect(buildStopViewSummary({ count: 7, soonestMinutes: 4 }, customT)).toBe(
      '7 buses · fastest in 4 min'
    );
  });
});
