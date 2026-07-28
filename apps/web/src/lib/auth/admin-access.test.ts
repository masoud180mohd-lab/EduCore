import { describe, expect, it } from 'vitest';

import {
  adminDeniedFallback,
  canAccessAdminShell,
  canManageTenantSettings,
  groupAdminNav,
  visibleAdminNavIds,
  type AdminNavId,
} from './admin-access.js';

describe('canAccessAdminShell', () => {
  it('allows owner/admin roles', () => {
    expect(canAccessAdminShell({ roles: [{ code: 'owner' }], permissions: [] })).toBe(true);
    expect(canAccessAdminShell({ roles: [{ code: 'admin' }], permissions: [] })).toBe(true);
  });

  it('allows staff with finance or student read (bursar / registry)', () => {
    expect(
      canAccessAdminShell({
        roles: [{ code: 'staff' }],
        permissions: ['finance.read', 'attendance.manage'],
      }),
    ).toBe(true);
    expect(
      canAccessAdminShell({
        roles: [{ code: 'staff' }],
        permissions: ['student.read', 'attendance.manage'],
      }),
    ).toBe(true);
  });

  it('denies attendance-only staff and parent-only', () => {
    expect(
      canAccessAdminShell({
        roles: [{ code: 'staff' }],
        permissions: ['attendance.manage', 'attendance.read'],
      }),
    ).toBe(false);
    expect(
      canAccessAdminShell({
        roles: [{ code: 'parent' }],
        permissions: ['parent.guardian.read', 'parent.finance.read'],
      }),
    ).toBe(false);
  });
});

describe('visibleAdminNavIds', () => {
  it('shows full nav for owner', () => {
    const ids = visibleAdminNavIds({ roles: [{ code: 'owner' }], permissions: [] });
    expect(ids.has('users')).toBe(true);
    expect(ids.has('fees')).toBe(true);
    expect(ids.has('settings')).toBe(true);
    expect(ids.has('roles')).toBe(true);
  });

  it('filters staff with finance+academic to Fees/Academic/Home only (no Users/Settings)', () => {
    const ids = visibleAdminNavIds({
      roles: [{ code: 'staff' }],
      permissions: ['finance.manage', 'academic.read', 'attendance.manage'],
    });
    expect(ids.has('home')).toBe(true);
    expect(ids.has('fees')).toBe(true);
    expect(ids.has('academic')).toBe(true);
    expect(ids.has('users')).toBe(false);
    expect(ids.has('settings')).toBe(false);
    expect(ids.has('roles')).toBe(false);
  });
});

describe('canManageTenantSettings', () => {
  it('allows owner/admin and tenant.manage', () => {
    expect(canManageTenantSettings({ roles: [{ code: 'owner' }], permissions: [] })).toBe(true);
    expect(
      canManageTenantSettings({ roles: [{ code: 'staff' }], permissions: ['tenant.manage'] }),
    ).toBe(true);
  });

  it('denies tenant.read only', () => {
    expect(
      canManageTenantSettings({ roles: [{ code: 'staff' }], permissions: ['tenant.read'] }),
    ).toBe(false);
  });
});

describe('adminDeniedFallback', () => {
  it('sends parents to parent home and others to teacher', () => {
    expect(
      adminDeniedFallback({
        roles: [{ code: 'parent' }],
        permissions: ['parent.guardian.read'],
      }),
    ).toBe('parent');
    expect(
      adminDeniedFallback({
        roles: [{ code: 'staff' }],
        permissions: ['attendance.manage'],
      }),
    ).toBe('teacher');
  });
});

describe('groupAdminNav (IMP-029)', () => {
  it('groups all owner ids and omits nothing when full set', () => {
    const ids = visibleAdminNavIds({ roles: [{ code: 'owner' }], permissions: [] });
    const groups = groupAdminNav(ids);
    expect(groups.map((g) => g.id)).toEqual([
      'home',
      'registry',
      'access',
      'academic',
      'fees',
      'settings',
    ]);
    expect(groups.find((g) => g.id === 'registry')?.items).toEqual([
      'students',
      'guardians',
      'organizations',
    ]);
    expect(groups.find((g) => g.id === 'access')?.items).toEqual(['users', 'memberships', 'roles']);
  });

  it('omits empty groups; finance-only sees Fees not Access', () => {
    const ids = visibleAdminNavIds({
      roles: [{ code: 'staff' }],
      permissions: ['finance.manage', 'attendance.manage'],
    });
    const groups = groupAdminNav(ids);
    expect(groups.map((g) => g.id)).toEqual(['home', 'fees']);
    expect(groups.some((g) => g.id === 'access')).toBe(false);
    expect(groups.some((g) => g.id === 'registry')).toBe(false);
  });

  it('keeps partial registry when only students visible', () => {
    const ids = new Set<AdminNavId>(['home', 'students']);
    const groups = groupAdminNav(ids);
    expect(groups.map((g) => g.id)).toEqual(['home', 'registry']);
    expect(groups.find((g) => g.id === 'registry')?.items).toEqual(['students']);
  });
});
