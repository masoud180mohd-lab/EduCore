import { describe, expect, it } from 'vitest';

import { PERMISSION_CODES } from '../../../common/policy/permission-codes.js';
import {
  isSystemRoleCode,
  permissionsForSystemRole,
  SYSTEM_ROLE_CODES,
  SYSTEM_ROLE_DEFINITIONS,
} from './system-roles.js';

describe('system role matrices (IMP-001 P4)', () => {
  it('defines system codes owner/admin/staff/bursar/parent', () => {
    expect([...SYSTEM_ROLE_CODES]).toEqual(['owner', 'admin', 'staff', 'bursar', 'parent']);
    expect(SYSTEM_ROLE_DEFINITIONS.map((d) => d.code)).toEqual([
      'owner',
      'admin',
      'staff',
      'bursar',
      'parent',
    ]);
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
    expect(staff).toContain('guardian.read');
    expect(staff).not.toContain('guardian.manage');
    expect(staff).toContain('marks.read');
    expect(staff).toContain('marks.manage');
    expect(staff).not.toContain('marks.approve');
    expect(staff).not.toContain('academic.manage');
    expect(staff).not.toContain('student.manage');
    expect(staff).not.toContain('tenant.manage');
    expect(staff).not.toContain('user.manage');
    expect(staff).not.toContain('role.manage');
    expect(staff).not.toContain('finance.read');
    expect(staff).not.toContain('finance.manage');
  });

  it('gives bursar finance.manage and not classroom writes', () => {
    const bursar = permissionsForSystemRole('bursar');
    expect(bursar).toContain('finance.read');
    expect(bursar).toContain('finance.manage');
    expect(bursar).toContain('student.read');
    expect(bursar).not.toContain('finance.reconcile');
    expect(bursar).not.toContain('attendance.manage');
    expect(bursar).not.toContain('marks.manage');
    expect(isSystemRoleCode('bursar')).toBe(true);
  });

  it('keeps parent portal-scoped without bursar finance.read', () => {
    const parent = permissionsForSystemRole('parent');
    expect(parent).toEqual(['parent.guardian.read', 'parent.finance.read']);
    expect(parent).not.toContain('finance.read');
    expect(parent).not.toContain('guardian.manage');
    expect(isSystemRoleCode('parent')).toBe(true);
  });

  it('type-guards system role codes', () => {
    expect(isSystemRoleCode('owner')).toBe(true);
    expect(isSystemRoleCode('teacher')).toBe(false);
  });
});
