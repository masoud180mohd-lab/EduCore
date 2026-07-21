import { describe, expect, it } from 'vitest';

import { buildUpsertPayload, mergeRosterWithRecords, setStudentStatus } from './mark-state.js';

describe('mark-state', () => {
  it('builds ACF upsert payload from drafts', () => {
    expect(
      buildUpsertPayload([
        { studentId: 'a', status: 'present', displayName: 'A' },
        { studentId: 'b', status: 'absent', displayName: 'B' },
      ]),
    ).toEqual({
      records: [
        { studentId: 'a', status: 'present' },
        { studentId: 'b', status: 'absent' },
      ],
    });
  });

  it('merges enrollments with existing records; defaults present', () => {
    const merged = mergeRosterWithRecords({
      enrollments: [{ studentId: 's1' }, { studentId: 's2' }],
      records: [{ studentId: 's1', status: 'late' }],
      names: { s1: 'Asha', s2: 'Juma' },
    });
    expect(merged).toEqual([
      { studentId: 's1', status: 'late', displayName: 'Asha' },
      { studentId: 's2', status: 'present', displayName: 'Juma' },
    ]);
  });

  it('updates one student status immutably', () => {
    const next = setStudentStatus(
      [{ studentId: 's1', status: 'present', displayName: 'A' }],
      's1',
      'excused',
    );
    expect(next[0]?.status).toBe('excused');
  });
});
