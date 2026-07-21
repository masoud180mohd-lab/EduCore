import { describe, expect, it } from 'vitest';

import { PERMISSION_CODES } from '../../../common/policy/permission-codes.js';
import {
  isSystemRoleCode,
  permissionsForSystemRole,
  SYSTEM_ROLE_CODES,
  SYSTEM_ROLE_DEFINITIONS,
} from './system-roles.js';

describe('system role matrices (IMP-001 P4)', () => {
  it('defines DBF-001 baseline codes owner/admin/staff', () => {
    expect([...SYSTEM_ROLE_CODES]).toEqual(['owner', 'admin', 'staff']);
    expect(SYSTEM_ROLE_DEFINITIONS.map((d) => d.code)).toEqual(['owner', 'admin', 'staff']);
  });

  it('gives owner the full permission catalogue', () => {
    expect(permissionsForSystemRole('owner')).toEqual([...PERMISSION_CODES]);
  });

  it('keeps entitlement.manage owner-only', () => {
    expect(permissionsForSystemRole('owner')).toContain('entitlement.manage');
    expect(permissionsForSystemRole('admin')).not.toContain('entitlement.manage');
    expect(permissionsForSystemRole('staff')).not.toContain('entitlement.manage');
  });

  it('keeps staff read-oriented except attendance.manage', () => {
    const staff = permissionsForSystemRole('staff');
    expect(staff).toContain('tenant.read');
    expect(staff).toContain('student.read');
    expect(staff).toContain('academic.read');
    expect(staff).toContain('attendance.read');
    expect(staff).toContain('attendance.manage');
    expect(staff).not.toContain('academic.manage');
    expect(staff).not.toContain('student.manage');
    expect(staff).not.toContain('tenant.manage');
    expect(staff).not.toContain('user.manage');
    expect(staff).not.toContain('role.manage');
  });

  it('type-guards system role codes', () => {
    expect(isSystemRoleCode('owner')).toBe(true);
    expect(isSystemRoleCode('teacher')).toBe(false);
  });
});
