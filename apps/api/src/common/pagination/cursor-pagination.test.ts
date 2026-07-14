import { describe, expect, it } from 'vitest';

import { AppError } from '../errors/app-error.js';
import {
  buildPaginatedResponse,
  PAGINATION_DEFAULT_LIMIT,
  parsePaginationQuery,
} from './cursor-pagination.js';

describe('cursor pagination helpers', () => {
  it('defaults limit to 25 and accepts bounds 1–100', () => {
    expect(parsePaginationQuery({})).toEqual({
      limit: PAGINATION_DEFAULT_LIMIT,
      cursor: undefined,
    });
    expect(parsePaginationQuery({ limit: '50', cursor: 'abc' })).toEqual({
      limit: 50,
      cursor: 'abc',
    });
  });

  it('rejects out-of-range limits', () => {
    expect(() => parsePaginationQuery({ limit: 0 })).toThrow(AppError);
    expect(() => parsePaginationQuery({ limit: 101 })).toThrow(AppError);
  });

  it('builds ACF page envelope', () => {
    expect(buildPaginatedResponse([{ id: 1 }], 25, null)).toEqual({
      data: [{ id: 1 }],
      page: { nextCursor: null, limit: 25 },
    });
  });
});
