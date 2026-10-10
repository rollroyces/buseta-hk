import { describe, it, expect } from 'vitest';
import { stripKmbOpSuffix, pickName, parseCsvLine, stripTags } from '../../src/utils/text.js';

describe('stripKmbOpSuffix', () => {
  it('strips a trailing (OPCODE) suffix', () => {
    expect(stripKmbOpSuffix('觀塘站 (KWT)')).toBe('觀塘站');
    expect(stripKmbOpSuffix('Central (CEN)')).toBe('Central');
  });

  it('leaves names without a suffix untouched', () => {
    expect(stripKmbOpSuffix('觀塘站')).toBe('觀塘站');
    expect(stripKmbOpSuffix('Mong Kok')).toBe('Mong Kok');
  });

  it('handles empty / nullish input', () => {
    expect(stripKmbOpSuffix('')).toBe('');
    expect(stripKmbOpSuffix(null)).toBe('');
    expect(stripKmbOpSuffix(undefined)).toBe('');
  });

  it('only strips a single trailing suffix', () => {
    expect(stripKmbOpSuffix('Foo (AB) (XY)')).toBe('Foo (AB)');
  });

  it('strips suffixes with mixed letters and digits', () => {
    expect(stripKmbOpSuffix('Bus Stop (K12)')).toBe('Bus Stop');
    expect(stripKmbOpSuffix('Stop (LWB1)')).toBe('Stop');
  });

  it('does not strip lowercase suffixes (regex is uppercase-only)', () => {
    expect(stripKmbOpSuffix('Foo (abc)')).toBe('Foo (abc)');
  });

  it('does not strip suffixes that start with a digit', () => {
    expect(stripKmbOpSuffix('Foo (1ABC)')).toBe('Foo (1ABC)');
  });

  it('handles internal whitespace before the suffix', () => {
    expect(stripKmbOpSuffix('Stop Name   (XYZ)')).toBe('Stop Name');
  });
});

describe('pickName', () => {
  const sample = {
    name_tc: '觀塘站',
    name_sc: '观塘站',
    name_en: 'Kwun Tong Station',
  };

  it('returns the Traditional Chinese name when lang is zh-Hant', () => {
    expect(pickName(sample, 'zh-Hant')).toBe('觀塘站');
  });

  it('returns the Simplified Chinese name when lang is zh-Hans', () => {
    expect(pickName(sample, 'zh-Hans')).toBe('观塘站');
  });

  it('returns the English name when lang is en', () => {
    expect(pickName(sample, 'en')).toBe('Kwun Tong Station');
  });

  it('falls back to the other Chinese variant if requested is empty', () => {
    const onlySc = { name_sc: '观塘站', name_en: 'Kwun Tong' };
    expect(pickName(onlySc, 'zh-Hant')).toBe('观塘站');
    const onlyTc = { name_tc: '觀塘站', name_en: 'Kwun Tong' };
    expect(pickName(onlyTc, 'zh-Hans')).toBe('觀塘站');
  });

  it('falls back to English if no Chinese variants are present', () => {
    const onlyEn = { name_en: 'Foo' };
    expect(pickName(onlyEn, 'zh-Hant')).toBe('Foo');
    expect(pickName(onlyEn, 'zh-Hans')).toBe('Foo');
  });

  it('returns empty string when obj is null or undefined', () => {
    expect(pickName(null, 'en')).toBe('');
    expect(pickName(undefined, 'zh-Hant')).toBe('');
  });

  it('returns empty string when no name fields are populated', () => {
    expect(pickName({}, 'zh-Hant')).toBe('');
    expect(pickName({ name_tc: '', name_sc: '', name_en: '' }, 'en')).toBe('');
  });

  it('accepts the camelCase aliases nameTc / nameSc / nameEn', () => {
    const camel = { nameTc: '觀塘站', nameSc: '观塘站', nameEn: 'Kwun Tong' };
    expect(pickName(camel, 'zh-Hant')).toBe('觀塘站');
    expect(pickName(camel, 'zh-Hans')).toBe('观塘站');
    expect(pickName(camel, 'en')).toBe('Kwun Tong');
  });
});

describe('parseCsvLine', () => {
  it('parses a simple comma-separated line', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles empty fields', () => {
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });

  it('returns one empty field for an empty line', () => {
    expect(parseCsvLine('')).toEqual(['']);
  });

  it('handles quoted fields with embedded commas', () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('handles escaped double-quotes inside quoted fields', () => {
    expect(parseCsvLine('a,"b""c",d')).toEqual(['a', 'b"c', 'd']);
  });

  it('handles fields with whitespace', () => {
    expect(parseCsvLine('a, b ,c')).toEqual(['a', ' b ', 'c']);
  });

  it('handles quoted field at the end of the line', () => {
    expect(parseCsvLine('a,b,"hello world"')).toEqual(['a', 'b', 'hello world']);
  });

  it('handles a single quoted field as the whole line', () => {
    expect(parseCsvLine('"only"')).toEqual(['only']);
  });
});

describe('stripTags', () => {
  it('strips a single tag', () => {
    expect(stripTags('<div>hello</div>')).toBe(' hello ');
  });
  it('strips nested tags', () => {
    expect(stripTags('<div><strong>service</strong> suspended</div>')).toBe(
      '  service  suspended '
    );
  });
  it('returns "" for null / undefined / empty input', () => {
    expect(stripTags(null)).toBe('');
    expect(stripTags(undefined)).toBe('');
    expect(stripTags('')).toBe('');
  });
  it('returns plain text unchanged', () => {
    expect(stripTags('no markup here')).toBe('no markup here');
  });
  it('strips self-closing tags', () => {
    expect(stripTags('line 1<br/>line 2')).toBe('line 1 line 2');
  });
  it('replaces tags with a single space (not empty)', () => {
    // Important: a separator is needed so joined words ("<b>suspend</b>ed")
    // don't merge into nonsense like "suspended".
    const out = stripTags('<b>suspend</b>ed');
    expect(out).toContain(' ');
  });
  it('handles tag attributes', () => {
    expect(stripTags('<a href="x" class="y">link</a>')).toBe(' link ');
  });
});
