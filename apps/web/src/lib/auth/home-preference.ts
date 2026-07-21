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
