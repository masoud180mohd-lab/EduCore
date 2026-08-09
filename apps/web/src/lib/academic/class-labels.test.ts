import { describe, expect, it } from 'vitest';

import { buildClassLabelMap, formatClassLabel } from './class-labels.js';

describe('class-labels', () => {
  it('formats name and optional code', () => {
    const map = buildClassLabelMap([
      { id: 'a', name: 'Form 1', code: 'F1' },
      { id: 'b', name: 'Form 2', code: null },
    ]);
    expect(formatClassLabel(map, 'a')).toBe('Form 1 (F1)');
    expect(formatClassLabel(map, 'b')).toBe('Form 2');
    expect(formatClassLabel(map, 'missing')).toBe('Unknown class');
  });
});
