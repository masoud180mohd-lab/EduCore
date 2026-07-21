export type AttendanceRecordStatus = 'present' | 'absent' | 'late' | 'excused';

export type MarkDraft = {
  readonly studentId: string;
  readonly status: AttendanceRecordStatus;
  readonly displayName: string;
};

export function buildUpsertPayload(drafts: readonly MarkDraft[]): {
  records: Array<{ studentId: string; status: AttendanceRecordStatus }>;
} {
  return {
    records: drafts.map((d) => ({ studentId: d.studentId, status: d.status })),
  };
}

export function setStudentStatus(
  drafts: readonly MarkDraft[],
  studentId: string,
  status: AttendanceRecordStatus,
): MarkDraft[] {
  return drafts.map((d) => (d.studentId === studentId ? { ...d, status } : d));
}

export function mergeRosterWithRecords(input: {
  readonly enrollments: ReadonlyArray<{ studentId: string }>;
  readonly records: ReadonlyArray<{ studentId: string; status: string }>;
  readonly names: Readonly<Record<string, string>>;
}): MarkDraft[] {
  const byStudent = new Map(input.records.map((r) => [r.studentId, r.status]));
  return input.enrollments.map((e) => {
    const raw = byStudent.get(e.studentId);
    const status: AttendanceRecordStatus =
      raw === 'present' || raw === 'absent' || raw === 'late' || raw === 'excused'
        ? raw
        : 'present';
    return {
      studentId: e.studentId,
      status,
      displayName: input.names[e.studentId] ?? e.studentId,
    };
  });
}
