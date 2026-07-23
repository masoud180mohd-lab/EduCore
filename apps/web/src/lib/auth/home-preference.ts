export type MeLike = {
  readonly roles?: ReadonlyArray<{ readonly code: string }>;
  readonly permissions?: ReadonlyArray<string>;
};

/** Admin home if owner/admin role or tenant/user/org manage surface. */
export function prefersAdminHome(me: MeLike): boolean {
  const roles = me.roles ?? [];
  if (roles.some((r) => r.code === 'owner' || r.code === 'admin')) return true;
  const perms = new Set(me.permissions ?? []);
  return (
    perms.has('tenant.manage') ||
    perms.has('user.manage') ||
    perms.has('user.invite') ||
    perms.has('organization.manage')
  );
}

/** Staff classroom/bursar surface — wins over parent when both apply. */
export function prefersStaffHome(me: MeLike): boolean {
  const roles = me.roles ?? [];
  if (roles.some((r) => r.code === 'staff')) return true;
  const perms = new Set(me.permissions ?? []);
  return (
    perms.has('attendance.manage') ||
    perms.has('finance.read') ||
    perms.has('finance.manage') ||
    perms.has('marks.manage')
  );
}

export function prefersParentHome(me: MeLike): boolean {
  const roles = me.roles ?? [];
  if (roles.some((r) => r.code === 'parent')) return true;
  const perms = new Set(me.permissions ?? []);
  return perms.has('parent.guardian.read') || perms.has('parent.finance.read');
}
