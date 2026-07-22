import { describe, expect, it } from 'vitest';

import { formatTzsMinor, parseMajorToMinor } from './money.js';

describe('formatTzsMinor', () => {
  it('formats minor units as major TZS with 2 decimals', () => {
    expect(formatTzsMinor(15000000)).toBe('TZS 150,000.00');
    expect(formatTzsMinor(100)).toBe('TZS 1.00');
    expect(formatTzsMinor(0)).toBe('TZS 0.00');
    expect(formatTzsMinor(150)).toBe('TZS 1.50');
  });

  it('rejects non-integers', () => {
    expect(formatTzsMinor(10.5)).toBe('TZS —');
    expect(formatTzsMinor(Number.NaN)).toBe('TZS —');
  });
});

describe('parseMajorToMinor', () => {
  it('converts major TZS to minor units (×100)', () => {
    expect(parseMajorToMinor('150000')).toBe(15000000);
    expect(parseMajorToMinor('1,500.50')).toBe(150050);
    expect(parseMajorToMinor('1.5')).toBe(150);
    expect(parseMajorToMinor('0.01')).toBe(1);
  });

  it('rejects invalid input', () => {
    expect(parseMajorToMinor('')).toBeNull();
    expect(parseMajorToMinor('0')).toBeNull();
    expect(parseMajorToMinor('-5')).toBeNull();
    expect(parseMajorToMinor('10.555')).toBeNull();
    expect(parseMajorToMinor('abc')).toBeNull();
  });
});
