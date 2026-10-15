import { describe, it, expect } from 'vitest';
import { classifyKmbOp, opCoKey } from '../../src/utils/operators.js';

describe('classifyKmbOp', () => {
  it('classifies A-prefix routes as LWB (Long Win to airport)', () => {
    expect(classifyKmbOp('A20')).toBe('LWB');
    expect(classifyKmbOp('A41')).toBe('LWB');
  });

  it('classifies E-prefix routes as LWB', () => {
    expect(classifyKmbOp('E11')).toBe('LWB');
    expect(classifyKmbOp('E33')).toBe('LWB');
  });

  it('classifies N-prefix routes as LWB (overnight airport)', () => {
    expect(classifyKmbOp('N11')).toBe('LWB');
    expect(classifyKmbOp('N30')).toBe('LWB');
  });

  it('classifies R/S/T-prefix routes as LWB', () => {
    expect(classifyKmbOp('R8')).toBe('LWB');
    expect(classifyKmbOp('S1')).toBe('LWB');
    expect(classifyKmbOp('T39')).toBe('LWB');
  });

  it('classifies X-prefix routes as LWB only with airport/border keywords', () => {
    expect(classifyKmbOp('X9', '東涌', '昂坪')).toBe('LWB');
    expect(classifyKmbOp('X9', '屯門', '元朗')).toBe('KMB');
  });

  it('defaults to KMB for plain numeric routes', () => {
    expect(classifyKmbOp('1')).toBe('KMB');
    expect(classifyKmbOp('970')).toBe('KMB');
    expect(classifyKmbOp('286C')).toBe('KMB');
  });

  it('handles empty / nullish input gracefully', () => {
    expect(classifyKmbOp('')).toBe('KMB');
    expect(classifyKmbOp(null)).toBe('KMB');
    expect(classifyKmbOp(undefined)).toBe('KMB');
  });

  it('case-insensitive', () => {
    expect(classifyKmbOp('a20')).toBe('LWB');
    expect(classifyKmbOp('x9', '東涌', '昂坪')).toBe('LWB');
  });

  it('trims whitespace', () => {
    expect(classifyKmbOp('  970  ')).toBe('KMB');
  });

  it('A-prefix wins over numeric (e.g. A20, not 20)', () => {
    expect(classifyKmbOp('A20')).toBe('LWB');
  });
});

describe('opCoKey', () => {
  it('maps known operator codes to lowercase', () => {
    expect(opCoKey('KMB')).toBe('kmb');
    expect(opCoKey('LWB')).toBe('lwb');
    expect(opCoKey('CTB')).toBe('ctb');
    expect(opCoKey('NWFB')).toBe('nwfb');
    expect(opCoKey('GMB')).toBe('gmb');
    expect(opCoKey('MTR')).toBe('mtr');
    expect(opCoKey('LRT')).toBe('lrt');
  });

  it('passes through unknown codes unchanged', () => {
    expect(opCoKey('XYZ')).toBe('XYZ');
    expect(opCoKey('')).toBe('');
  });
});
