'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { TeacherShell } from '@/components/TeacherShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type Exam = {
  readonly id: string;
  readonly name: string;
  readonly classId: string;
  readonly status: string;
};

type ExamSubject = {
  readonly id: string;
  readonly subjectId: string;
  readonly maxScore: number | string;
  readonly status: string;
};

type SubjectRow = { readonly id: string; readonly name: string };

export default function ExamDetailPage() {
  const params = useParams<{ tenantId: string; examId: string }>();
  const { tenantId, examId } = params;
  const [exam, setExam] = useState<Exam | null>(null);
  const [subjects, setSubjects] = useState<ExamSubject[]>([]);
  const [catalog, setCatalog] = useState<SubjectRow[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const [exRes, subRes, catRes] = await Promise.all([
        apiRequest<{ data: Exam }>(`/api/v1/exams/${examId}`, { auth }),
        apiRequest<{ data: ExamSubject[] }>(`/api/v1/exams/${examId}/subjects`, { auth }),
        apiRequest<{ data: SubjectRow[] }>('/api/v1/subjects?limit=100&status=active', { auth }),
      ]);
      setExam(exRes.data);
      setSubjects(subRes.data ?? []);
      setCatalog(catRes.data ?? []);
      const map: Record<string, string> = {};
      for (const s of catRes.data ?? []) map[s.id] = s.name;
      setNames(map);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not load exam.');
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAddSubject(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || subjectId === '') return;
    setBusy(true);
    setError(null);
    const actionKey = `exam.subject:${examId}:${subjectId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/exams/${examId}/subjects`, {
        method: 'POST',
        auth,
        body: { subjectId, maxScore: Number(maxScore) },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setSubjectId('');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not add subject.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeacherShell tenantId={tenantId}>
      <p>
        <Link href={`/t/${tenantId}/teacher/marks`}>← Marks</Link>
      </p>
      <AdminPageHeader title={exam?.name ?? 'Exam'}>
        {exam !== null ? <p className="muted">Status {exam.status}</p> : null}
      </AdminPageHeader>
      {error !== null ? <Banner tone="error">{error}</Banner> : null}

      <form className="stack card" onSubmit={(e) => void onAddSubject(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Add subject</h2>
        <div className="field">
          <label htmlFor="subjectId">Subject</label>
          <select
            id="subjectId"
            required
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">Select subject</option>
            {catalog.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="maxScore">Max score</label>
          <input
            id="maxScore"
            type="number"
            min={1}
            step="0.01"
            required
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || subjectId === ''}>
          {busy ? 'Adding…' : 'Add subject'}
        </button>
      </form>

      <h2 style={{ fontSize: '1.1rem' }}>Subjects</h2>
      {subjects.length === 0 ? <Banner tone="info">No subjects yet.</Banner> : null}
      <ul className="list">
        {subjects.map((s) => (
          <li key={s.id}>
            <Link className="card" href={`/t/${tenantId}/teacher/marks/subjects/${s.id}`}>
              <strong>{names[s.subjectId] ?? s.subjectId}</strong>{' '}
              <span className={`chip chip-${s.status === 'draft' ? 'open' : 'closed'}`}>
                {s.status}
              </span>
              <div className="muted">Max {String(s.maxScore)}</div>
            </Link>
          </li>
        ))}
      </ul>
    </TeacherShell>
  );
}
