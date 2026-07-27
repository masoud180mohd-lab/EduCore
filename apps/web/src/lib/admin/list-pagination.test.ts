import { describe, expect, it } from 'vitest';

import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  hasMorePages,
  readPageMeta,
} from './list-pagination.js';

describe('buildListQuery', () => {
  it('sets default limit and omits empty filters', () => {
    expect(buildListQuery('/api/v1/students')).toBe(
      `/api/v1/students?limit=${String(ADMIN_LIST_DEFAULT_LIMIT)}`,
    );
    expect(
      buildListQuery('/api/v1/students', {
        limit: 50,
        filters: { search: '  ', status: undefined, academicYearId: null },
      }),
    ).toBe('/api/v1/students?limit=50');
  });

  it('encodes cursor and filters', () => {
    expect(
      buildListQuery('/api/v1/users', {
        limit: 50,
        cursor: '01900000-0000-7000-8000-0000000000aa',
        filters: { search: 'a b' },
      }),
    ).toBe('/api/v1/users?limit=50&cursor=01900000-0000-7000-8000-0000000000aa&search=a+b');
  });
});

describe('readPageMeta / hasMorePages / appendById', () => {
  it('treats missing page as exhausted', () => {
    expect(readPageMeta({ data: [] })).toEqual({ nextCursor: null, limit: 50 });
    expect(hasMorePages(null)).toBe(false);
    expect(hasMorePages('abc')).toBe(true);
  });

  it('appends and de-dupes by id', () => {
    const first = [{ id: 'a', name: '1' }];
    const second = [
      { id: 'a', name: '1-dup' },
      { id: 'b', name: '2' },
    ];
    expect(appendById(first, second)).toEqual([
      { id: 'a', name: '1' },
      { id: 'b', name: '2' },
    ]);
  });

  it('reads nextCursor from envelope', () => {
    expect(
      readPageMeta({
        data: [{ id: '1' }],
        page: { nextCursor: 'c1', limit: 50 },
      }),
    ).toEqual({ nextCursor: 'c1', limit: 50 });
  });
});
