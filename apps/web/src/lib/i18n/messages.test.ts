import { describe, expect, it } from 'vitest';

import { EN, SW } from './messages.js';

describe('i18n catalog', () => {
  it('keeps EN and SW keys in parity', () => {
    expect(Object.keys(SW).sort()).toEqual(Object.keys(EN).sort());
  });
});
