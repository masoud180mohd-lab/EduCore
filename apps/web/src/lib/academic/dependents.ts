import type { ApiClientError } from '@/lib/api/client';

export type DependentSample = {
  readonly id: string;
  readonly label: string;
};

export type DependentGroup = {
  readonly type: string;
  readonly count: number;
  readonly samples: ReadonlyArray<DependentSample>;
};

export function parseDeleteDependents(err: ApiClientError): DependentGroup[] | null {
  if (err.status !== 409 || err.details === undefined) return null;
  const raw = err.details['dependents'];
  if (!Array.isArray(raw)) return null;
  const groups: DependentGroup[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (typeof row['type'] !== 'string' || typeof row['count'] !== 'number') continue;
    const samplesRaw = row['samples'];
    const samples: DependentSample[] = [];
    if (Array.isArray(samplesRaw)) {
      for (const sample of samplesRaw) {
        if (sample === null || typeof sample !== 'object' || Array.isArray(sample)) continue;
        const s = sample as Record<string, unknown>;
        if (typeof s['id'] === 'string' && typeof s['label'] === 'string') {
          samples.push({ id: s['id'], label: s['label'] });
        }
      }
    }
    groups.push({ type: row['type'], count: row['count'], samples });
  }
  return groups.length > 0 ? groups : null;
}

const TYPE_LABELS: Record<string, string> = {
  terms: 'Terms',
  classes: 'Classes',
  streams: 'Streams',
  subjects: 'Subjects',
  enrollments: 'Enrollments',
  attendance_sessions: 'Attendance sessions',
  exams: 'Exams',
  exam_subjects: 'Exam subjects',
  fee_structures: 'Fee structures',
  invoices: 'Invoices',
};

export function dependentTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type.replaceAll('_', ' ');
}

export function dependentAdminHref(tenantId: string, type: string, id: string): string | null {
  switch (type) {
    case 'terms':
      return `/t/${tenantId}/admin/academic/terms/${id}`;
    case 'classes':
      return `/t/${tenantId}/admin/academic/classes/${id}`;
    case 'streams':
      return `/t/${tenantId}/admin/academic/streams/${id}`;
    case 'subjects':
      return `/t/${tenantId}/admin/academic/subjects/${id}`;
    case 'enrollments':
      return `/t/${tenantId}/admin/academic/enrollments/${id}`;
    case 'fee_structures':
      return `/t/${tenantId}/admin/fees/structures/${id}`;
    case 'invoices':
      return `/t/${tenantId}/admin/fees/invoices/${id}`;
    default:
      return null;
  }
}
