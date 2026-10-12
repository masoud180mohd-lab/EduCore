import { ApiClientError, teacherFriendlyMessage } from '@/lib/api/client';

export type UserRow = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: string;
};

export type UserStatus = 'invited' | 'active' | 'disabled' | 'locked';

export type InviteRoleCode = 'owner' | 'admin' | 'staff';

export const USER_STATUSES: ReadonlyArray<UserStatus> = ['invited', 'active', 'disabled', 'locked'];

export const INVITE_ROLE_CODES: ReadonlyArray<InviteRoleCode> = ['owner', 'admin', 'staff'];

export function userMessage(err: ApiClientError): string {
  if (err.status === 403) return 'You do not have access for this action.';
  if (err.status === 409) return err.message || 'Conflict — membership already exists.';
  return teacherFriendlyMessage(err);
}
