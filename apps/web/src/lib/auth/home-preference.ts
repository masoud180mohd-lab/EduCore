export type MeLike = {
  readonly roles?: ReadonlyArray<{ readonly code: string }>;
  readonly permissions?: ReadonlyArray<string>;
  readonly platformOperator?: boolean;
};

/** Head portal — marks approvers / school leaders (DSF-008 Phase 3a). */
export function prefersHeadHome(me: MeLike): boolean {
  const perms = new Set(me.permissions ?? []);
  if (perms.has('marks.approve')) return true;
  const roles = me.roles ?? [];
  // Lab: owner/admin hold marks.approve in seed; keep role fallback if perms omitted from /me.
  return roles.some((r) => r.code === 'owner' || r.code === 'admin');
}

/** Admin home if owner/admin/bursar or tenant/user/org manage surface. */
export function prefersAdminHome(me: MeLike): boolean {
  const roles = me.roles ?? [];
  if (roles.some((r) => r.code === 'owner' || r.code === 'admin' || r.code === 'bursar')) {
    return true;
  }
  const perms = new Set(me.permissions ?? []);
  return (
    perms.has('tenant.manage') ||
    perms.has('user.manage') ||
    perms.has('user.invite') ||
    perms.has('organization.manage') ||
    perms.has('finance.manage')
  );
}

/** Classroom staff surface — wins over parent when both apply. Not bursar. */
export function prefersStaffHome(me: MeLike): boolean {
  const roles = me.roles ?? [];
  if (roles.some((r) => r.code === 'staff')) return true;
  const perms = new Set(me.permissions ?? []);
  return perms.has('attendance.manage') || perms.has('marks.manage');
}

export function prefersParentHome(me: MeLike): boolean {
  const roles = me.roles ?? [];
  if (roles.some((r) => r.code === 'parent')) return true;
  const perms = new Set(me.permissions ?? []);
  return perms.has('parent.guardian.read') || perms.has('parent.finance.read');
}

/** Bound learner portal (DSF-009). Lowest preferential home after parent. */
export function prefersStudentHome(me: MeLike): boolean {
  const roles = me.roles ?? [];
  if (roles.some((r) => r.code === 'student')) return true;
  const perms = new Set(me.permissions ?? []);
  return perms.has('student.self.read');
}
