import { ApiClientError, teacherFriendlyMessage } from '@/lib/api/client';

export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'transferred' | 'draft';

export type StudentRow = {
  readonly id: string;
  readonly displayName: string;
  readonly studentCode: string | null;
  readonly status: string;
};

export const STUDENT_STATUSES: ReadonlyArray<StudentStatus> = [
  'active',
  'inactive',
  'graduated',
  'transferred',
  'draft',
];

export function studentMessage(err: ApiClientError): string {
  if (err.status === 403) return 'You do not have access for this action.';
  if (err.status === 409) return err.message || 'Conflict — duplicate student code.';
  return teacherFriendlyMessage(err);
}
