/**
 * DBF-001 baseline system roles for a tenant (ADR-012 / IMP-001 P4).
 * Codes are product-owned; keep in sync with seed bootstrap and docs.
 */
import { PERMISSION_CODES, type PermissionCode } from '../../../common/policy/permission-codes.js';

export const SYSTEM_ROLE_CODES = ['owner', 'admin', 'staff', 'parent'] as const;
export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

export type SystemRoleDefinition = {
  readonly code: SystemRoleCode;
  readonly name: string;
  readonly permissions: ReadonlyArray<PermissionCode>;
};

/** Classroom staff baseline: reads + attendance.manage for teacher mark flow. */
const STAFF_PERMISSIONS: ReadonlyArray<PermissionCode> = [
  'tenant.read',
  'organization.read',
  'user.read',
  'student.read',
  'academic.read',
  'attendance.read',
  'attendance.manage',
  'guardian.read',
  'marks.read',
  'marks.manage',
  'finance.read',
  'finance.manage',
  'notification.read',
  'notification.manage',
  'role.read',
  'audit.read',
  'entitlement.read',
];

/** Bound guardian portal (DBF-011 / ACF-013) — no bursar finance.read. */
const PARENT_PERMISSIONS: ReadonlyArray<PermissionCode> = [
  'parent.guardian.read',
  'parent.finance.read',
];

/**
 * Owner holds full identity/tenant admin catalogue.
 * Admin matches owner except entitlement.manage (owner-only).
 * Staff is classroom/bursar-oriented.
 * Parent is portal-scoped only.
 */
export const SYSTEM_ROLE_DEFINITIONS: ReadonlyArray<SystemRoleDefinition> = [
  {
    code: 'owner',
    name: 'Owner',
    permissions: [...PERMISSION_CODES],
  },
  {
    code: 'admin',
    name: 'Admin',
    permissions: PERMISSION_CODES.filter((code) => code !== 'entitlement.manage'),
  },
  {
    code: 'staff',
    name: 'Staff',
    permissions: STAFF_PERMISSIONS,
  },
  {
    code: 'parent',
    name: 'Parent',
    permissions: PARENT_PERMISSIONS,
  },
];

export function isSystemRoleCode(value: string): value is SystemRoleCode {
  return (SYSTEM_ROLE_CODES as readonly string[]).includes(value);
}

export function permissionsForSystemRole(code: SystemRoleCode): ReadonlyArray<PermissionCode> {
  const def = SYSTEM_ROLE_DEFINITIONS.find((row) => row.code === code);
  if (def === undefined) {
    return [];
  }
  return def.permissions;
}
