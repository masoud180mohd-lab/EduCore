import { describe, expect, it } from 'vitest';

import {
  prefersAdminHome,
  prefersParentHome,
  prefersStaffHome,
  prefersStudentHome,
} from './home-preference';

describe('prefersAdminHome', () => {
  it('routes owner/admin roles to admin', () => {
    expect(prefersAdminHome({ roles: [{ code: 'owner' }], permissions: [] })).toBe(true);
    expect(prefersAdminHome({ roles: [{ code: 'admin' }], permissions: [] })).toBe(true);
  });

  it('routes staff without admin manage perms to teacher', () => {
    expect(
      prefersAdminHome({
        roles: [{ code: 'staff' }],
        permissions: ['attendance.manage', 'student.read'],
      }),
    ).toBe(false);
  });

  it('routes user.invite / tenant.manage to admin', () => {
    expect(prefersAdminHome({ roles: [], permissions: ['user.invite'] })).toBe(true);
    expect(prefersAdminHome({ roles: [], permissions: ['tenant.manage'] })).toBe(true);
  });
});

describe('prefersStaffHome / prefersParentHome / prefersStudentHome', () => {
  it('routes bursar / finance.manage to admin, not teacher', () => {
    expect(prefersAdminHome({ roles: [{ code: 'bursar' }], permissions: [] })).toBe(true);
    expect(prefersAdminHome({ roles: [], permissions: ['finance.manage'] })).toBe(true);
    expect(prefersStaffHome({ roles: [], permissions: ['finance.read'] })).toBe(false);
    expect(
      prefersParentHome({ roles: [{ code: 'parent' }], permissions: ['parent.finance.read'] }),
    ).toBe(true);
  });

  it('detects parent role and parent.* permissions', () => {
    expect(prefersParentHome({ roles: [{ code: 'parent' }], permissions: [] })).toBe(true);
    expect(prefersParentHome({ roles: [], permissions: ['parent.guardian.read'] })).toBe(true);
    expect(prefersParentHome({ roles: [{ code: 'staff' }], permissions: [] })).toBe(false);
  });

  it('detects student role and student.self.read', () => {
    expect(prefersStudentHome({ roles: [{ code: 'student' }], permissions: [] })).toBe(true);
    expect(prefersStudentHome({ roles: [], permissions: ['student.self.read'] })).toBe(true);
    expect(prefersStudentHome({ roles: [{ code: 'parent' }], permissions: [] })).toBe(false);
  });
});
