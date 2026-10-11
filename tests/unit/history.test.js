// @vitest-environment jsdom
//
// Tests for src/utils/history.js — the journey-history helper added
// in Phase 44. The whole module is localStorage-backed; jsdom gives
// us a real (per-test) localStorage so the tests can exercise the
// read / write round-trip without mocking globalThis.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HISTORY_KEY,
  HISTORY_CAP,
  readHistory,
  recordVisit,
  getHistory,
  getHistoryGroupedByDay,
  removeHistoryEntry,
  clearHistory,
} from '../../src/utils/history.js';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* private mode etc. */
  }
});

describe('readHistory / recordVisit', () => {
  it('starts empty on a fresh localStorage', () => {
    expect(readHistory()).toEqual([]);
    expect(getHistory()).toEqual([]);
  });

  it('records a single entry and returns the updated array', () => {
    const list = recordVisit({ kind: 'stop', id: 'A1', name: 'Foo Stop', ts: 1 });
    expect(list.length).toBe(1);
    expect(list[0].kind).toBe('stop');
    expect(list[0].id).toBe('A1');
    expect(list[0].name).toBe('Foo Stop');
    expect(list[0].ts).toBe(1);
  });

  it('persists the entry to localStorage', () => {
    recordVisit({ kind: 'route', id: 'KMB|10|I|1', name: '10' });
    const raw = localStorage.getItem(HISTORY_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw);
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe('KMB|10|I|1');
  });

  it('records multiple entries with the newest at index 0', () => {
    recordVisit({ kind: 'stop', id: 'A1', name: 'Stop A', ts: 1 });
    recordVisit({ kind: 'stop', id: 'B2', name: 'Stop B', ts: 2 });
    const list = getHistory();
    expect(list.map((e) => e.id)).toEqual(['B2', 'A1']);
  });

  it('dedups consecutive duplicates — re-recording moves the entry to the top', () => {
    recordVisit({ kind: 'stop', id: 'A1', name: 'A', ts: 1 });
    recordVisit({ kind: 'stop', id: 'B2', name: 'B', ts: 2 });
    recordVisit({ kind: 'stop', id: 'A1', name: 'A', ts: 3 });
    const list = getHistory();
    expect(list.length).toBe(2);
    expect(list[0].id).toBe('A1');
    expect(list[0].ts).toBe(3);
    expect(list[1].id).toBe('B2');
  });

  it('dedups same kind:id even when re-recorded without anything in between', () => {
    recordVisit({ kind: 'route', id: 'KMB|10|I|1', ts: 1 });
    recordVisit({ kind: 'route', id: 'KMB|10|I|1', ts: 2 });
    const list = getHistory();
    expect(list.length).toBe(1);
    expect(list[0].ts).toBe(2);
  });

  it('treats different `kind` as distinct even when `id` collides', () => {
    recordVisit({ kind: 'stop', id: 'X', ts: 1 });
    recordVisit({ kind: 'station', id: 'X', ts: 2 });
    const list = getHistory();
    expect(list.length).toBe(2);
  });

  it('records an entry without a `ts` (sort treats it as oldest)', () => {
    // The helper does not auto-fill Date.now() — the caller is
    // responsible for stamping ts. An entry recorded without a ts
    // sorts to the bottom of getHistory() because the comparator
    // uses `(ts || 0)`. This guards legacy / hand-written localStorage
    // entries against breaking the sort.
    const before = Date.now();
    recordVisit({ kind: 'stop', id: 'A' });
    const list = getHistory();
    expect(list[0].ts).toBeUndefined();
    // Sanity: a ts-less entry written within the test window still
    // doesn't get assigned a hidden timestamp.
    expect(list[0].ts == null || list[0].ts < before).toBe(true);
  });

  it('drops non-finite `ts` values and leaves the entry without a timestamp', () => {
    recordVisit({ kind: 'stop', id: 'A', ts: NaN });
    const list = getHistory();
    expect(list[0].ts).toBeUndefined();
  });

  it('returns the existing array when given a malformed entry', () => {
    recordVisit({ kind: 'stop', id: 'A', ts: 1 });
    const list = recordVisit(null);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('A');
  });

  it('rejects entries missing `kind` or `id` (no throw, no write)', () => {
    recordVisit({ id: 'A' }); // missing kind
    recordVisit({ kind: 'stop' }); // missing id
    recordVisit({});
    expect(readHistory()).toEqual([]);
  });

  it('normalises `kind` and `id` to strings', () => {
    recordVisit({ kind: 42, id: 100, ts: 1 });
    const list = getHistory();
    expect(list[0].kind).toBe('42');
    expect(list[0].id).toBe('100');
  });
});

describe('recordVisit — HISTORY_CAP enforcement', () => {
  it('caps the array at HISTORY_CAP entries (drops oldest tail)', () => {
    // Insert HISTORY_CAP + 5 entries with strictly increasing ts so
    // we can predict the survivors.
    const N = HISTORY_CAP + 5;
    for (let i = 0; i < N; i++) {
      recordVisit({ kind: 'stop', id: `S${i}`, name: `Stop ${i}`, ts: i + 1 });
    }
    const list = getHistory();
    expect(list.length).toBe(HISTORY_CAP);
    // Newest entry (S_(N-1)) is at the top; oldest survivors are the
    // first HISTORY_CAP inserts (S0..S4 were evicted).
    expect(list[0].id).toBe(`S${N - 1}`);
    expect(list[list.length - 1].id).toBe(`S5`);
  });

  it('does not evict when inserting up to the cap exactly', () => {
    for (let i = 0; i < HISTORY_CAP; i++) {
      recordVisit({ kind: 'stop', id: `S${i}`, ts: i + 1 });
    }
    expect(getHistory().length).toBe(HISTORY_CAP);
  });

  it('dedup-and-cap interact: re-recording an existing entry does not consume a slot', () => {
    for (let i = 0; i < HISTORY_CAP - 1; i++) {
      recordVisit({ kind: 'stop', id: `S${i}`, ts: i + 1 });
    }
    // Re-record S0 — should still leave the array at HISTORY_CAP - 1,
    // not bump it to HISTORY_CAP.
    recordVisit({ kind: 'stop', id: 'S0', ts: 9999 });
    expect(getHistory().length).toBe(HISTORY_CAP - 1);
    expect(getHistory()[0].id).toBe('S0');
    expect(getHistory()[0].ts).toBe(9999);
  });
});

describe('getHistory', () => {
  it('sorts DESC by `ts` regardless of insertion order', () => {
    recordVisit({ kind: 'stop', id: 'A', ts: 100 });
    recordVisit({ kind: 'stop', id: 'B', ts: 300 });
    recordVisit({ kind: 'stop', id: 'C', ts: 200 });
    const list = getHistory();
    expect(list.map((e) => e.id)).toEqual(['B', 'C', 'A']);
  });

  it('tolerates entries without a `ts` (sorts them to the bottom)', () => {
    recordVisit({ kind: 'stop', id: 'A', ts: 100 });
    recordVisit({ kind: 'stop', id: 'B' }); // no ts
    recordVisit({ kind: 'stop', id: 'C', ts: 50 });
    const list = getHistory();
    expect(list[0].id).toBe('A');
    expect(list[1].id).toBe('C');
    expect(list[2].id).toBe('B');
  });
});

describe('getHistoryGroupedByDay', () => {
  // Anchor `now` to a known local midnight so the day-boundary math is
  // reproducible regardless of which timezone the CI runner sits in.
  // `new Date(2024, 5, 15, 14, 30, 0)` is local time, so its
  // `setHours(0, 0, 0, 0)` lands on 2024-06-15 00:00 local.
  const now = new Date(2024, 5, 15, 14, 30, 0).getTime();

  it('returns three empty arrays when there is no history', () => {
    const g = getHistoryGroupedByDay(now);
    expect(g).toEqual({ today: [], yesterday: [], earlier: [] });
  });

  it('buckets an entry from today into the `today` group', () => {
    const todayMid = new Date(now);
    todayMid.setHours(9, 0, 0, 0);
    recordVisit({ kind: 'stop', id: 'A', ts: todayMid.getTime() });
    const g = getHistoryGroupedByDay(now);
    expect(g.today.length).toBe(1);
    expect(g.yesterday.length).toBe(0);
    expect(g.earlier.length).toBe(0);
    expect(g.today[0].id).toBe('A');
  });

  it('buckets an entry from yesterday into the `yesterday` group', () => {
    const yesterdayMid = new Date(now);
    yesterdayMid.setDate(yesterdayMid.getDate() - 1);
    yesterdayMid.setHours(8, 0, 0, 0);
    recordVisit({ kind: 'stop', id: 'B', ts: yesterdayMid.getTime() });
    const g = getHistoryGroupedByDay(now);
    expect(g.today.length).toBe(0);
    expect(g.yesterday.length).toBe(1);
    expect(g.earlier.length).toBe(0);
    expect(g.yesterday[0].id).toBe('B');
  });

  it('buckets an entry from two days ago into `earlier`', () => {
    const earlier = new Date(now);
    earlier.setDate(earlier.getDate() - 2);
    earlier.setHours(12, 0, 0, 0);
    recordVisit({ kind: 'stop', id: 'C', ts: earlier.getTime() });
    const g = getHistoryGroupedByDay(now);
    expect(g.today.length).toBe(0);
    expect(g.yesterday.length).toBe(0);
    expect(g.earlier.length).toBe(1);
    expect(g.earlier[0].id).toBe('C');
  });

  it('puts entries exactly on today midnight into `today` (inclusive boundary)', () => {
    const todayMid = new Date(now);
    todayMid.setHours(0, 0, 0, 0);
    recordVisit({ kind: 'stop', id: 'D', ts: todayMid.getTime() });
    const g = getHistoryGroupedByDay(now);
    expect(g.today.length).toBe(1);
    expect(g.yesterday.length).toBe(0);
  });

  it('splits a mixed list into all three buckets and sorts each DESC', () => {
    const earlier = new Date(now);
    earlier.setDate(earlier.getDate() - 3);
    earlier.setHours(10, 0, 0, 0);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(20, 0, 0, 0);
    const today1 = new Date(now);
    today1.setHours(8, 0, 0, 0);
    const today2 = new Date(now);
    today2.setHours(15, 0, 0, 0);

    recordVisit({ kind: 'stop', id: 'old', ts: earlier.getTime() });
    recordVisit({ kind: 'stop', id: 'yest', ts: yesterday.getTime() });
    recordVisit({ kind: 'stop', id: 'today-early', ts: today1.getTime() });
    recordVisit({ kind: 'stop', id: 'today-late', ts: today2.getTime() });

    const g = getHistoryGroupedByDay(now);
    expect(g.today.map((e) => e.id)).toEqual(['today-late', 'today-early']);
    expect(g.yesterday.map((e) => e.id)).toEqual(['yest']);
    expect(g.earlier.map((e) => e.id)).toEqual(['old']);
  });

  it('defaults `now` to Date.now() when called without an argument', () => {
    const before = Date.now();
    recordVisit({ kind: 'stop', id: 'A', ts: before - 1000 });
    const g = getHistoryGroupedByDay();
    expect(g.today.length).toBe(1);
  });
});

describe('removeHistoryEntry', () => {
  it('removes a single matching entry and leaves others intact', () => {
    recordVisit({ kind: 'stop', id: 'A', ts: 1 });
    recordVisit({ kind: 'stop', id: 'B', ts: 2 });
    recordVisit({ kind: 'route', id: 'KMB|10|I|1', ts: 3 });
    const after = removeHistoryEntry('stop', 'B');
    expect(after.map((e) => e.id).sort()).toEqual(['A', 'KMB|10|I|1']);
  });

  it('is a no-op when the entry does not exist', () => {
    recordVisit({ kind: 'stop', id: 'A', ts: 1 });
    const after = removeHistoryEntry('stop', 'B');
    expect(after.length).toBe(1);
    expect(after[0].id).toBe('A');
  });

  it('removes only the matching kind:id pair (not all with the same id)', () => {
    recordVisit({ kind: 'stop', id: 'X', ts: 1 });
    recordVisit({ kind: 'station', id: 'X', ts: 2 });
    const after = removeHistoryEntry('stop', 'X');
    expect(after.length).toBe(1);
    expect(after[0].kind).toBe('station');
  });

  it('persists the removal to localStorage', () => {
    recordVisit({ kind: 'stop', id: 'A', ts: 1 });
    removeHistoryEntry('stop', 'A');
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY))).toEqual([]);
  });
});

describe('clearHistory', () => {
  it('wipes every entry', () => {
    recordVisit({ kind: 'stop', id: 'A', ts: 1 });
    recordVisit({ kind: 'stop', id: 'B', ts: 2 });
    const after = clearHistory();
    expect(after).toEqual([]);
    expect(getHistory()).toEqual([]);
  });

  it('persists the wipe to localStorage', () => {
    recordVisit({ kind: 'stop', id: 'A', ts: 1 });
    clearHistory();
    expect(localStorage.getItem(HISTORY_KEY)).toBe('[]');
  });
});
