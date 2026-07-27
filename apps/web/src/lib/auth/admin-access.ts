/**
 * Admin shell access (IMP-033 / AUDIT-ADMIN-UI-R1 G1).
 * UX gate only — API remains AuthZ truth. Never invent permissions client-side.
 */
import type { MeLike } from '@/lib/auth/home-preference';

export type AdminNavId =
  | 'home'
  | 'users'
  | 'memberships'
  | 'organizations'
  | 'students'
  | 'guardians'
  | 'roles'
  | 'academic'
  | 'fees'
  | 'settings';

const ADMIN_SHELL_PERMS = [
  'tenant.manage',
  'tenant.read',
  'user.manage',
  'user.invite',
  'user.read',
  'organization.manage',
  'organization.read',
  'student.manage',
  'student.read',
  'guardian.manage',
  'guardian.read',
  'role.manage',
  'role.read',
  'academic.manage',
  'academic.read',
  'finance.manage',
  'finance.read',
  'finance.reconcile',
] as const;

/** True when the actor may open AdminShell at all (any admin-domain capability). */
export function canAccessAdminShell(me: MeLike): boolean {
  const roles = me.roles ?? [];
  if (roles.some((r) => r.code === 'owner' || r.code === 'admin')) return true;
  const perms = new Set(me.permissions ?? []);
  return ADMIN_SHELL_PERMS.some((code) => perms.has(code));
}

function hasAny(perms: ReadonlySet<string>, codes: ReadonlyArray<string>): boolean {
  return codes.some((c) => perms.has(c));
}

/** Which top-nav items to show for this actor. Home is always included when shell is allowed. */
export function visibleAdminNavIds(me: MeLike): ReadonlySet<AdminNavId> {
  const roles = me.roles ?? [];
  if (roles.some((r) => r.code === 'owner' || r.code === 'admin')) {
    return new Set<AdminNavId>([
      'home',
      'users',
      'memberships',
      'organizations',
      'students',
      'guardians',
      'roles',
      'academic',
      'fees',
      'settings',
    ]);
  }

  const perms = new Set(me.permissions ?? []);
  const visible = new Set<AdminNavId>(['home']);

  if (hasAny(perms, ['user.read', 'user.manage', 'user.invite'])) {
    visible.add('users');
    visible.add('memberships');
  }
  if (hasAny(perms, ['organization.read', 'organization.manage'])) {
    visible.add('organizations');
  }
  if (hasAny(perms, ['student.read', 'student.manage'])) {
    visible.add('students');
  }
  if (hasAny(perms, ['guardian.read', 'guardian.manage'])) {
    visible.add('guardians');
  }
  if (hasAny(perms, ['role.read', 'role.manage'])) {
    visible.add('roles');
  }
  if (hasAny(perms, ['academic.read', 'academic.manage'])) {
    visible.add('academic');
  }
  if (hasAny(perms, ['finance.read', 'finance.manage', 'finance.reconcile'])) {
    visible.add('fees');
  }
  if (hasAny(perms, ['tenant.manage', 'tenant.read'])) {
    visible.add('settings');
  }

  return visible;
}

export type AdminFallbackHome = 'teacher' | 'parent';

/** Where to send actors who opened /admin without shell access. */
export function adminDeniedFallback(me: MeLike): AdminFallbackHome {
  const roles = me.roles ?? [];
  if (roles.some((r) => r.code === 'parent')) return 'parent';
  const perms = new Set(me.permissions ?? []);
  if (perms.has('parent.guardian.read') || perms.has('parent.finance.read')) {
    return 'parent';
  }
  return 'teacher';
}

export type AdminNavGroupId = 'home' | 'registry' | 'access' | 'academic' | 'fees' | 'settings';

export type AdminNavGroup = {
  readonly id: AdminNavGroupId;
  readonly label: string;
  readonly items: ReadonlyArray<AdminNavId>;
};

/** IA groups for AdminShell (IMP-029 Option A). Membership order is display order. */
const ADMIN_NAV_GROUP_DEFS: ReadonlyArray<{
  readonly id: AdminNavGroupId;
  readonly label: string;
  readonly members: ReadonlyArray<AdminNavId>;
}> = [
  { id: 'home', label: 'Home', members: ['home'] },
  { id: 'registry', label: 'Registry', members: ['students', 'guardians', 'organizations'] },
  { id: 'access', label: 'Access', members: ['users', 'memberships', 'roles'] },
  { id: 'academic', label: 'Academic', members: ['academic'] },
  { id: 'fees', label: 'Fees', members: ['fees'] },
  { id: 'settings', label: 'Settings', members: ['settings'] },
];

/**
 * Group visible nav ids for tablet IA. Empty groups are omitted.
 * Does not invent visibility — input must already be `visibleAdminNavIds`.
 */
export function groupAdminNav(visibleIds: ReadonlySet<AdminNavId>): ReadonlyArray<AdminNavGroup> {
  const groups: AdminNavGroup[] = [];
  for (const def of ADMIN_NAV_GROUP_DEFS) {
    const items = def.members.filter((id) => visibleIds.has(id));
    if (items.length === 0) continue;
    groups.push({ id: def.id, label: def.label, items });
  }
  return groups;
}
