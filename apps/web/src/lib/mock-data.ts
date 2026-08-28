export type AttendanceStatus = 'present' | 'absent' | 'late';

export const school = {
  name: 'Mlimani Secondary School',
  code: 'MLM-041',
  term: 'Term 2 · 2026',
};

export const headmasterProfile = {
  name: 'Dr. Joseph Mtei',
  role: 'Headmaster',
  kpis: {
    students: 842,
    teachers: 38,
    attendanceTodayPct: 94,
    feesCollectedTzs: 48_200_000,
    feesTargetTzs: 72_000_000,
  },
  classAttendance: [
    { className: 'Form 1A', present: 38, total: 40 },
    { className: 'Form 1B', present: 35, total: 39 },
    { className: 'Form 2A', present: 36, total: 38 },
    { className: 'Form 2B', present: 33, total: 37 },
    { className: 'Form 3A', present: 41, total: 42 },
    { className: 'Form 4A', present: 29, total: 34 },
  ],
  pendingApprovals: [
    {
      id: 'a1',
      title: 'Exam marks — Form 2A Mathematics',
      requester: 'Mr. Kimaro',
      type: 'marks',
    },
    {
      id: 'a2',
      title: 'Expense: Lab chemicals (TZS 420,000)',
      requester: 'Bursar',
      type: 'expense',
    },
    {
      id: 'a3',
      title: 'Leave request — Ms. Lyimo (3 days)',
      requester: 'HR',
      type: 'leave',
    },
  ],
  alerts: [
    {
      id: 'al1',
      severity: 'high' as const,
      text: 'Form 4A attendance dropped below 85% this week',
    },
    {
      id: 'al2',
      severity: 'medium' as const,
      text: '128 parents have unpaid Term 2 balances over 30 days',
    },
    {
      id: 'al3',
      severity: 'low' as const,
      text: '3 teachers have not submitted weekly lesson plans',
    },
  ],
};

export function formatTzs(amount: number) {
  return new Intl.NumberFormat('sw-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(amount);
}
