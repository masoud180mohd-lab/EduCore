import { describe, expect, it } from 'vitest';

import {
  clickPesaMajorToMinor,
  mapClickPesaStatus,
  minorToClickPesaMajor,
} from './clickpesa-money.js';

describe('clickpesa-money', () => {
  it('converts minor to major only when divisible by 100', () => {
    expect(minorToClickPesaMajor(15000000)).toBe(150000);
    expect(() => minorToClickPesaMajor(150)).toThrow(/divisible by 100/);
    expect(() => minorToClickPesaMajor(0)).toThrow(/positive/);
  });

  it('converts major collected amounts to minor', () => {
    expect(clickPesaMajorToMinor('10000')).toBe(1_000_000);
    expect(clickPesaMajorToMinor(10000)).toBe(1_000_000);
    expect(() => clickPesaMajorToMinor(-1)).toThrow();
  });

  it('maps ClickPesa statuses per PAY-002', () => {
    expect(mapClickPesaStatus('SUCCESS')).toBe('succeeded');
    expect(mapClickPesaStatus('SETTLED')).toBe('succeeded');
    expect(mapClickPesaStatus('PENDING')).toBe('pending');
    expect(mapClickPesaStatus('PROCESSING')).toBe('pending');
    expect(mapClickPesaStatus('ON-HOLD')).toBe('pending');
    expect(mapClickPesaStatus('FAILED')).toBe('failed');
    expect(mapClickPesaStatus('REFUNDED')).toBe('ignored');
  });
});
