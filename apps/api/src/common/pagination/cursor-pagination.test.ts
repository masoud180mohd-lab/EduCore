import { describe, expect, it } from 'vitest';

import { AppError } from '../errors/app-error.js';
import {
  buildPaginatedResponse,
  PAGINATION_DEFAULT_LIMIT,
  parsePaginationQuery,
} from './cursor-pagination.js';

const validCursor = '01900000-0000-7000-8000-0000000000c1';

describe('cursor pagination helpers', () => {
  it('defaults limit to 25 and accepts bounds 1–100', () => {
    expect(parsePaginationQuery({})).toEqual({
      limit: PAGINATION_DEFAULT_LIMIT,
      cursor: undefined,
    });
    expect(parsePaginationQuery({ limit: '50', cursor: validCursor })).toEqual({
      limit: 50,
      cursor: validCursor,
    });
  });

  it('rejects out-of-range limits', () => {
    expect(() => parsePaginationQuery({ limit: 0 })).toThrow(AppError);
    expect(() => parsePaginationQuery({ limit: 101 })).toThrow(AppError);
  });

  it('rejects non-uuid cursors with validation error', () => {
    expect(() => parsePaginationQuery({ cursor: 'abc' })).toThrow(AppError);
    try {
      parsePaginationQuery({ cursor: 'abc' });
    } catch (error) {
      expect(error).toMatchObject({ code: 'VALIDATION_ERROR' });
    }
  });

  it('builds ACF page envelope', () => {
    expect(buildPaginatedResponse([{ id: 1 }], 25, null)).toEqual({
      data: [{ id: 1 }],
      page: { nextCursor: null, limit: 25 },
    });
  });
});
