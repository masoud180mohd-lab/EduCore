'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { TeacherShell } from '@/components/TeacherShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type ExamRow = {
  readonly id: string;
  readonly name: string;
  readonly classId: string;
  readonly status: string;
  readonly academicYearId: string;
};

type ClassRow = { readonly id: string; readonly name: string };
type YearRow = { readonly id: string; readonly name: string };

export default function MarksHomePage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [years, setYears] = useState<YearRow[]>([]);
  const [name, setName] = useState('');
  const [classId, setClassId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const [exRes, clRes, yrRes] = await Promise.all([
          apiRequest<{ data: ExamRow[] }>('/api/v1/exams?limit=50', { auth }),
          apiRequest<{ data: ClassRow[] }>('/api/v1/classes?limit=100&status=active', { auth }),
          apiRequest<{ data: YearRow[] }>('/api/v1/academic-years?limit=50', { auth }),
        ]);
        setExams(exRes.data ?? []);
        setClasses(clRes.data ?? []);
        setYears(yrRes.data ?? []);
      } catch (err) {
        if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
        else setError('Could not load exams.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    const actionKey = `exam.create:${name}:${classId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const created = await apiRequest<{ data: ExamRow }>('/api/v1/exams', {
        method: 'POST',
        auth,
        body: { name: name.trim(), classId, academicYearId, status: 'open' },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      router.push(`/t/${tenantId}/teacher/marks/exams/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not create exam.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeacherShell tenantId={tenantId}>
      <h1>Marks</h1>
      <p className="muted">Create an exam, add subjects, enter scores, then submit.</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>New exam</h2>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="academicYearId">Academic year</label>
          <select
            id="academicYearId"
            required
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
          >
            <option value="">Select year</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="classId">Class</label>
          <select
            id="classId"
            required
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || classId === '' || academicYearId === ''}
        >
          {busy ? 'Creating…' : 'Create exam'}
        </button>
      </form>

      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && exams.length === 0 ? (
        <div className="banner banner-info">No exams yet.</div>
      ) : null}
      <ul className="list">
        {exams.map((exam) => (
          <li key={exam.id}>
            <Link className="card" href={`/t/${tenantId}/teacher/marks/exams/${exam.id}`}>
              <strong>{exam.name}</strong>{' '}
              <span className={`chip chip-${exam.status === 'open' ? 'open' : 'closed'}`}>
                {exam.status}
              </span>
              <div className="muted">Class {exam.classId}</div>
            </Link>
          </li>
        ))}
      </ul>
    </TeacherShell>
  );
}
