import { ApiClientError } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';

export type LifecycleStatus = 'draft' | 'active' | 'closed';

export type AcademicYearRow = {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly status: string;
};

export type TermRow = {
  readonly id: string;
  readonly academicYearId: string;
  readonly name: string;
  readonly code: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly status: string;
};

export type ClassRow = {
  readonly id: string;
  readonly academicYearId: string;
  readonly termId: string | null;
  readonly name: string;
  readonly code: string | null;
  readonly status: string;
};

export type StreamRow = {
  readonly id: string;
  readonly classId: string;
  readonly name: string;
  readonly code: string | null;
  readonly status: string;
};

export type SubjectRow = {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly status: string;
};

export type EnrollmentRow = {
  readonly id: string;
  readonly studentId: string;
  readonly classId: string;
  readonly streamId: string | null;
  readonly academicYearId: string;
  readonly termId: string | null;
  readonly status: string;
};

export type StudentOption = {
  readonly id: string;
  readonly displayName: string;
};

export const LIFECYCLE_STATUSES: ReadonlyArray<LifecycleStatus> = ['active', 'draft', 'closed'];

export const ENROLLMENT_STATUSES = ['active', 'withdrawn', 'completed', 'suspended'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/** @deprecated Use adminFriendlyMessage(err, 'academic') */
export function academicMessage(err: ApiClientError): string {
  return adminFriendlyMessage(err, 'academic');
}
