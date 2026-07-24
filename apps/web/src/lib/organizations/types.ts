import { ApiClientError, teacherFriendlyMessage } from '@/lib/api/client';

export type OrgType = 'school' | 'campus' | 'department';

export type OrganizationRow = {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly orgType: string;
  readonly status: string;
  readonly parentOrganizationId?: string | null;
};

export const ORG_TYPES: ReadonlyArray<OrgType> = ['school', 'campus', 'department'];

export function organizationMessage(err: ApiClientError): string {
  if (err.status === 403) return 'You do not have access for this action.';
  if (err.status === 409) return err.message || 'Conflict — organization code already in use.';
  return teacherFriendlyMessage(err);
}
