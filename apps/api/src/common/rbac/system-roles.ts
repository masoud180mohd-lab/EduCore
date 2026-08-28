/** DBF-001 baseline system roles shared by trusted bootstrap and Identity RBAC. */
import { PERMISSION_CODES, type PermissionCode } from '../policy/permission-codes.js';

export const SYSTEM_ROLE_CODES = [
  'owner',
  'admin',
  'staff',
  'bursar',
  'parent',
  'student',
] as const;
export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

export type SystemRoleDefinition = {
  readonly code: SystemRoleCode;
  readonly name: string;
  readonly permissions: ReadonlyArray<PermissionCode>;
};

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
  'notification.read',
  'notification.manage',
  'ai.read',
  'ai.manage',
  'role.read',
  'audit.read',
  'entitlement.read',
];
const BURSAR_PERMISSIONS: ReadonlyArray<PermissionCode> = [
  'tenant.read',
  'organization.read',
  'student.read',
  'academic.read',
  'guardian.read',
  'finance.read',
  'finance.manage',
];
const PARENT_PERMISSIONS: ReadonlyArray<PermissionCode> = [
  'parent.guardian.read',
  'parent.finance.read',
];
const STUDENT_PERMISSIONS: ReadonlyArray<PermissionCode> = ['student.self.read'];

export const SYSTEM_ROLE_DEFINITIONS: ReadonlyArray<SystemRoleDefinition> = [
  { code: 'owner', name: 'Owner', permissions: [...PERMISSION_CODES] },
  {
    code: 'admin',
    name: 'Admin',
    permissions: PERMISSION_CODES.filter((code) => code !== 'entitlement.manage'),
  },
  { code: 'staff', name: 'Staff', permissions: STAFF_PERMISSIONS },
  { code: 'bursar', name: 'Bursar', permissions: BURSAR_PERMISSIONS },
  { code: 'parent', name: 'Parent', permissions: PARENT_PERMISSIONS },
  { code: 'student', name: 'Student', permissions: STUDENT_PERMISSIONS },
];

export function isSystemRoleCode(value: string): value is SystemRoleCode {
  return (SYSTEM_ROLE_CODES as readonly string[]).includes(value);
}

export function permissionsForSystemRole(code: SystemRoleCode): ReadonlyArray<PermissionCode> {
  return SYSTEM_ROLE_DEFINITIONS.find((row) => row.code === code)?.permissions ?? [];
}
