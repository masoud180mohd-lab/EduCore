import { describe, expect, it } from 'vitest';

import { mapAcademicDeleteDependentsConflict } from './academic-delete-conflict.js';

describe('mapAcademicDeleteDependentsConflict', () => {
  it('returns null for unrelated errors', () => {
    expect(mapAcademicDeleteDependentsConflict(new Error('nope'), 'academic year')).toBeNull();
  });

  it('maps plain has-dependents without detail', () => {
    const mapped = mapAcademicDeleteDependentsConflict(
      { code: 'P0001', message: 'has dependents' },
      'academic year',
    );
    expect(mapped).toMatchObject({
      code: 'CONFLICT',
      message: 'Cannot delete academic year with dependents.',
      details: undefined,
    });
  });

  it('parses dependents from PG DETAIL json', () => {
    const mapped = mapAcademicDeleteDependentsConflict(
      {
        code: 'P0001',
        message: 'has dependents',
        detail: JSON.stringify({
          dependents: [
            {
              type: 'terms',
              count: 2,
              samples: [{ id: '01900000-0010-7000-8000-000000000101', label: 'Term 1' }],
            },
          ],
        }),
      },
      'academic year',
    );
    expect(mapped?.details).toEqual({
      dependents: [
        {
          type: 'terms',
          count: 2,
          samples: [{ id: '01900000-0010-7000-8000-000000000101', label: 'Term 1' }],
        },
      ],
    });
  });
});
