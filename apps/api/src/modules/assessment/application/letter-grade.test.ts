import { describe, expect, it } from 'vitest';

import { letterGrade, percentageScore } from './letter-grade.js';

describe('letterGrade', () => {
  it('maps the ACF-011 derived scale', () => {
    expect(letterGrade(80)).toBe('A');
    expect(letterGrade(79.9)).toBe('B');
    expect(letterGrade(70)).toBe('B');
    expect(letterGrade(60)).toBe('C');
    expect(letterGrade(50)).toBe('D');
    expect(letterGrade(49.9)).toBe('F');
    expect(letterGrade(null)).toBeNull();
  });
});

describe('percentageScore', () => {
  it('rounds to one decimal and rejects invalid max', () => {
    expect(percentageScore(72, 100)).toBe(72);
    expect(percentageScore(1, 3)).toBe(33.3);
    expect(percentageScore(null, 100)).toBeNull();
    expect(percentageScore(10, 0)).toBeNull();
  });
});
