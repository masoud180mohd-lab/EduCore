import { describe, expect, it } from 'vitest';

import { prefersAdminHome } from './home-preference.js';

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
