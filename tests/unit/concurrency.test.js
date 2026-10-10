import { describe, it, expect, vi } from 'vitest';
import { mapWithCap } from '../../src/utils/concurrency.js';

describe('mapWithCap', () => {
  it('returns an empty array for empty input', async () => {
    const out = await mapWithCap([], 4, async () => 1);
    expect(out).toEqual([]);
  });

  it('preserves input order in the output array', async () => {
    const out = await mapWithCap([10, 20, 30, 40], 2, async (n) => n * 2);
    expect(out.map((r) => r.value)).toEqual([20, 40, 60, 80]);
  });

  it('caps in-flight workers at the given value (peak ≤ cap)', async () => {
    let inFlightPeak = 0;
    let inFlightNow = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    await mapWithCap(items, 4, async (n) => {
      inFlightNow++;
      if (inFlightNow > inFlightPeak) inFlightPeak = inFlightNow;
      // Yield a few microtasks so other workers can race to enter.
      await new Promise((r) => setTimeout(r, 5));
      inFlightNow--;
      return n;
    });
    expect(inFlightPeak).toBeLessThanOrEqual(4);
    // Sanity: with 20 items and a cap of 4, peak should actually reach 4.
    expect(inFlightPeak).toBe(4);
  });

  it('clamps cap to [1, items.length] (never 0 or negative)', async () => {
    const out = await mapWithCap([1, 2, 3], 0, async (n) => n);
    expect(out.map((r) => r.value)).toEqual([1, 2, 3]);
    const outNeg = await mapWithCap([1, 2, 3], -5, async (n) => n);
    expect(outNeg.map((r) => r.value)).toEqual([1, 2, 3]);
  });

  it('returns { ok: true, value } on success', async () => {
    const [r] = await mapWithCap(['a'], 1, async (s) => s.toUpperCase());
    expect(r.ok).toBe(true);
    expect(r.value).toBe('A');
  });

  it('returns { ok: false, error } on rejection (does not throw)', async () => {
    const [a, b, c] = await mapWithCap([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('boom');
      return n * 10;
    });
    expect(a).toEqual({ ok: true, value: 10 });
    expect(b.ok).toBe(false);
    expect(b.error).toBeInstanceOf(Error);
    expect(b.error.message).toBe('boom');
    expect(c).toEqual({ ok: true, value: 30 });
  });

  it('passes the item index to the worker', async () => {
    const seen = [];
    await mapWithCap(['a', 'b', 'c'], 1, async (item, idx) => {
      seen.push([item, idx]);
      return null;
    });
    expect(seen).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });

  it('handles a single-item input', async () => {
    const [r] = await mapWithCap([42], 4, async (n) => n + 1);
    expect(r).toEqual({ ok: true, value: 43 });
  });

  it('handles cap > items.length (does not over-spawn workers)', async () => {
    let peak = 0;
    let now = 0;
    const items = [1, 2, 3];
    await mapWithCap(items, 100, async (n) => {
      now++;
      if (now > peak) peak = now;
      await new Promise((r) => setTimeout(r, 5));
      now--;
      return n;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBe(3);
  });

  it('continues processing after a rejection', async () => {
    const calls = vi.fn(async (n) => n);
    const out = await mapWithCap([1, 2, 3, 4, 5], 2, async (n) => {
      calls(n);
      if (n === 3) throw new Error('mid-fail');
      return n;
    });
    expect(calls).toHaveBeenCalledTimes(5);
    expect(out[2].ok).toBe(false);
    expect(out.map((r) => (r.ok ? r.value : null))).toEqual([1, 2, null, 4, 5]);
  });
});
