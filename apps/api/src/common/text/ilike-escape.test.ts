import { describe, expect, it } from 'vitest';

import { AppError } from '../errors/app-error.js';
import {
  escapeIlikePattern,
  parseOptionalSearchFilter,
  SEARCH_DEFAULT_MAX_LEN,
} from './ilike-escape.js';

describe('ilike escape helpers', () => {
  it('escapes backslash, percent, and underscore', () => {
    expect(escapeIlikePattern('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
  });

  it('returns undefined for blank search', () => {
    expect(parseOptionalSearchFilter(undefined)).toBeUndefined();
    expect(parseOptionalSearchFilter('')).toBeUndefined();
    expect(parseOptionalSearchFilter('   ')).toBeUndefined();
  });

  it('escapes and trims valid search', () => {
    expect(parseOptionalSearchFilter('  a%b  ')).toBe('a\\%b');
  });

  it('rejects non-string and over-length search', () => {
    expect(() => parseOptionalSearchFilter(1)).toThrow(AppError);
    expect(() => parseOptionalSearchFilter('x'.repeat(SEARCH_DEFAULT_MAX_LEN + 1))).toThrow(
      AppError,
    );
  });
});
