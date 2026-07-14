/**
 * Permission codes from DBF-001 / ACF-001 seed catalogue.
 * Keep in sync with `permissions` seed migration.
 */
export const PERMISSION_CODES = [
  'tenant.read',
  'tenant.manage',
  'organization.read',
  'organization.manage',
  'user.invite',
  'user.read',
  'user.manage',
  'role.read',
  'role.manage',
  'session.revoke',
  'audit.read',
  'entitlement.read',
  'entitlement.manage',
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export function isPermissionCode(value: string): value is PermissionCode {
  return (PERMISSION_CODES as readonly string[]).includes(value);
}
