import { describe, it, expect } from 'vitest';
import {
  walkMinutes,
  rideMinutes,
  WALK_M_PER_MIN,
  BUS_KMH_M_PER_MIN,
} from '../../src/utils/time.js';

describe('walkMinutes', () => {
  it('uses 60 m/min baseline (v47 comment)', () => {
    expect(WALK_M_PER_MIN).toBe(60);
  });

  it('returns minutes at the walking speed', () => {
    expect(walkMinutes(60)).toBe(1);
    expect(walkMinutes(600)).toBe(10);
    expect(walkMinutes(0)).toBe(0);
  });

  it('handles fractional inputs', () => {
    expect(walkMinutes(300)).toBe(5);
    expect(walkMinutes(30)).toBe(0.5);
  });
});

describe('rideMinutes', () => {
  it('derives from 20 km/h', () => {
    expect(BUS_KMH_M_PER_MIN).toBeCloseTo((20 * 1000) / 60, 5);
  });

  it('returns minutes at the bus speed', () => {
    // 20 km/h = 333.33 m/min, so 1000 m ≈ 3 minutes
    expect(rideMinutes(1000)).toBeCloseTo(3, 1);
  });

  it('handles zero', () => {
    expect(rideMinutes(0)).toBe(0);
  });
});