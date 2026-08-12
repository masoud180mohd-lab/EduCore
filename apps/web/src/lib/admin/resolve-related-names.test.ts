/**
 * IMP-040 helpers for Admin UUID → display names.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiRequest: vi.fn(),
}));

import { looksLikeUuid, missingNameIds } from './resolve-related-names.js';

describe('missingNameIds', () => {
  it('returns ids not yet in the known map', () => {
    expect(missingNameIds(['a', 'b', 'a', null, ''], { a: 'Alpha' })).toEqual(['b']);
  });
});

describe('looksLikeUuid', () => {
  it('accepts canonical UUID strings', () => {
    expect(looksLikeUuid('01900000-0000-7000-8000-000000000001')).toBe(true);
    expect(looksLikeUuid(' 01900000-0000-7000-8000-000000000001 ')).toBe(true);
  });

  it('rejects non-UUID paste', () => {
    expect(looksLikeUuid('')).toBe(false);
    expect(looksLikeUuid('not-a-uuid')).toBe(false);
    expect(looksLikeUuid('01900000-0000-7000-8000')).toBe(false);
  });
});
