import { describe, it, expect } from 'vitest';
import {
  classifyOperator,
  extractRouteNumbers,
  classifySeverity,
} from '../../src/utils/disruption-classify.js';

describe('classifyOperator', () => {
  it('matches KMB on TC + EN', () => {
    expect(classifyOperator('九巴第15號線服務調整', 'KMB Route 15 Service Adjustment')).toBe('KMB');
  });
  it('matches LWB before GMB (Long Win)', () => {
    expect(classifyOperator('龍運巴士A35線', 'Long Win Bus Route A35')).toBe('LWB');
  });
  it('matches CTB', () => {
    expect(classifyOperator('城巴第10號線', 'CTB Route 10')).toBe('CTB');
  });
  it('matches NWFB', () => {
    expect(classifyOperator('新巴第8X號線', 'NWFB Route 8X')).toBe('NWFB');
  });
  it('matches GMB (Green Minibus, fallback minibus)', () => {
    expect(classifyOperator('專線小巴第45號線', 'GMB Route 45')).toBe('GMB');
  });
  it('matches MTR (feeder bus)', () => {
    expect(classifyOperator('港鐵巴士第K12號線', 'MTR Feeder Bus Route K12')).toBe('MTR');
  });
  it('matches LRT', () => {
    expect(classifyOperator('輕鐵第614線', 'Light Rail Route 614')).toBe('LRT');
  });
  it('returns null for area-wide notices', () => {
    expect(classifyOperator('華富道巴士站遷移', 'Bus Stop Relocation on Wah Fu Road')).toBe(null);
  });
  it('returns null on null / empty input', () => {
    expect(classifyOperator('', '')).toBe(null);
    expect(classifyOperator(null, null)).toBe(null);
  });
});

describe('extractRouteNumbers', () => {
  it('extracts a single CN route', () => {
    expect(extractRouteNumbers('九巴第15號線', '')).toEqual(['15']);
  });
  it('extracts a single EN route', () => {
    expect(extractRouteNumbers('', 'KMB Route No. 15 service adjustment.')).toEqual(['15']);
  });
  it('extracts a list of CN routes separated by 、', () => {
    expect(extractRouteNumbers('九巴第15、16、17號線繞道', '')).toEqual(['15', '16', '17']);
  });
  it('extracts a list of EN routes separated by "and"', () => {
    expect(extractRouteNumbers('', 'KMB Route Nos. 15 and 16 detour.')).toEqual(['15', '16']);
  });
  it('extracts a list of EN routes separated by commas', () => {
    expect(extractRouteNumbers('', 'Route Nos. 1, 2, 3 affected.')).toEqual(['1', '2', '3']);
  });
  it('deduplicates TC + EN overlap', () => {
    expect(extractRouteNumbers('九巴第15號線', 'KMB Route No. 15 adjustment.')).toEqual(['15']);
  });
  it('returns [] for area-wide notices with no route numbers', () => {
    expect(extractRouteNumbers('華富道巴士站遷移', 'Bus Stop Relocation on Wah Fu Road')).toEqual(
      []
    );
  });
  it('returns [] on null / empty input', () => {
    expect(extractRouteNumbers('', '')).toEqual([]);
    expect(extractRouteNumbers(null, null)).toEqual([]);
  });
  it('extracts alphanumeric routes (X11, K12, 8X)', () => {
    expect(extractRouteNumbers('九巴第X11號線', 'Route No. 8X.')).toEqual(['X11', '8X']);
  });
});

describe('classifySeverity', () => {
  it('returns severe for 暫停', () => {
    expect(classifySeverity('九巴第15號線暫停服務', '', '', '')).toBe('severe');
  });
  it('returns severe for suspended (EN)', () => {
    expect(classifySeverity('', 'Route suspended.', '', '')).toBe('severe');
  });
  it('returns warn for detour (EN)', () => {
    expect(classifySeverity('', 'Route detour.', '', '')).toBe('warn');
  });
  it('returns warn for 改道', () => {
    expect(classifySeverity('九巴第15號線改道', '', '', '')).toBe('warn');
  });
  it('returns info for fare / enhancement', () => {
    expect(classifySeverity('九巴加強服務', 'KMB fare adjustment', '', '')).toBe('info');
  });
  it('severe wins over warn when both keywords are present', () => {
    expect(classifySeverity('路線暫停及改道', 'Route suspended and detour', '', '')).toBe('severe');
  });
  it('warn wins over info when both keywords are present', () => {
    expect(classifySeverity('路線改道及新增站', 'Route detour and new stop', '', '')).toBe('warn');
  });
  it('sniffs content bodies, not just titles', () => {
    expect(classifySeverity('', '', '本路線將暫停服務直至另行通知', '')).toBe('severe');
  });
  it('defaults to info when no keywords match', () => {
    expect(classifySeverity('一般通告', 'General notice', '', '')).toBe('info');
  });
  it('handles null / empty inputs gracefully', () => {
    expect(classifySeverity(null, null, null, null)).toBe('info');
  });
});
