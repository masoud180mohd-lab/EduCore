import { describe, expect, it } from 'vitest';

import {
  activeLinkedStudentIds,
  guardianFeesMutationsAllowed,
  isStudentInAllowlist,
} from './guardian-fees-access.js';

describe('guardian fees isolation', () => {
  it('allowlists only active links', () => {
    const ids = activeLinkedStudentIds([
      { studentId: 's1', status: 'active' },
      { studentId: 's2', status: 'ended' },
      { studentId: 's3', status: 'active' },
    ]);
    expect([...ids].sort()).toEqual(['s1', 's3']);
  });

  it('rejects students outside the allowlist', () => {
    const ids = activeLinkedStudentIds([{ studentId: 's1', status: 'active' }]);
    expect(isStudentInAllowlist('s1', ids)).toBe(true);
    expect(isStudentInAllowlist('s2', ids)).toBe(false);
  });

  it('never allows bursar mutations on guardian fees surface', () => {
    expect(guardianFeesMutationsAllowed()).toBe(false);
  });
});
