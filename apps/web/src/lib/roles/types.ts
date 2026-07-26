import { ApiClientError, teacherFriendlyMessage } from '@/lib/api/client';

export type RoleRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly isSystem: boolean;
  readonly permissions: ReadonlyArray<string>;
};

export type PermissionRow = {
  readonly id: string;
  readonly code: string;
  readonly description: string;
};

export type UserRoleRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly roleId: string;
  readonly organizationId: string | null;
  readonly roleCode: string;
  readonly createdAt: string;
};

export function roleMessage(err: ApiClientError): string {
  if (err.status === 403) return 'You do not have access for this action.';
  if (err.status === 409) return err.message || 'Conflict — role or assignment already exists.';
  return teacherFriendlyMessage(err);
}
