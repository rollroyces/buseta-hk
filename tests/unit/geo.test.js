import { describe, it, expect } from 'vitest';
import { haversine, formatDistance } from '../../src/utils/geo.js';

describe('haversine', () => {
  it('returns 0 for identical points', () => {
    expect(haversine(22.3, 114.2, 22.3, 114.2)).toBe(0);
  });

  it('handles antipodal points (~20015 km pole-to-pole)', () => {
    const d = haversine(90, 0, -90, 0);
    expect(d).toBeCloseTo(20015.087, 0);
  });

  it('computes TSW → CEN at the right order of magnitude', () => {
    // Tsim Sha Tsui (22.301, 114.174) → Central (22.282, 114.158)
    // Real distance is ~2.5 km across the harbour. The haversine is a
    // great-circle distance, so it'll be a bit less than the real
    // walking route (which goes via the Star Ferry).
    const d = haversine(22.301, 114.174, 22.282, 114.158);
    expect(d).toBeGreaterThan(2.0);
    expect(d).toBeLessThan(3.5);
  });

  it('is symmetric in the two points', () => {
    const a = haversine(22.3, 114.1, 22.4, 114.2);
    const b = haversine(22.4, 114.2, 22.3, 114.1);
    expect(a).toBeCloseTo(b, 10);
  });

  it('handles cross-equator distances', () => {
    // Singapore (1.35, 103.82) → Jakarta (-6.20, 106.85)
    // Real ~890 km
    const d = haversine(1.35, 103.82, -6.2, 106.85);
    expect(d).toBeGreaterThan(850);
    expect(d).toBeLessThan(930);
  });
});

describe('formatDistance', () => {
  it('formats under 1 km in metres, no decimals', () => {
    expect(formatDistance(0.123)).toBe('123 m');
    expect(formatDistance(0.5)).toBe('500 m');
    expect(formatDistance(0.999)).toBe('999 m');
  });

  it('formats 1 km and above in km, one decimal place', () => {
    expect(formatDistance(1)).toBe('1.0 km');
    expect(formatDistance(1.5)).toBe('1.5 km');
    expect(formatDistance(14.9)).toBe('14.9 km');
    expect(formatDistance(100)).toBe('100.0 km');
  });

  it('handles 0', () => {
    expect(formatDistance(0)).toBe('0 m');
  });

  it('rounds 0.0005 km up to 1 m', () => {
    expect(formatDistance(0.0005)).toBe('1 m');
  });
});