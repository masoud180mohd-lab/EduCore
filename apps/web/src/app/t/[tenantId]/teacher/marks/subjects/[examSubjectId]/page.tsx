'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { TeacherShell } from '@/components/TeacherShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type ExamSubject = {
  readonly id: string;
  readonly examId: string;
  readonly subjectId: string;
  readonly maxScore: number | string;
  readonly status: string;
};

type Exam = { readonly id: string; readonly classId: string; readonly name: string };
type MarkRow = {
  readonly studentId: string;
  readonly score: number | string | null;
  readonly note: string | null;
};
type Enrollment = { readonly studentId: string };
type Student = { readonly id: string; readonly displayName: string };

type Draft = {
  readonly studentId: string;
  readonly displayName: string;
  readonly score: string;
};

export default function MarkEntryPage() {
  const params = useParams<{ tenantId: string; examSubjectId: string }>();
  const { tenantId, examSubjectId } = params;
  const [subject, setSubject] = useState<ExamSubject | null>(null);
  const [examName, setExamName] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const locked = subject !== null && subject.status !== 'draft';
  const canApprove = subject?.status === 'submitted';

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    setError(null);
    try {
      const subjectRes = await apiRequest<{ data: ExamSubject }>(
        `/api/v1/exam-subjects/${examSubjectId}`,
        { auth },
      );
      const found = subjectRes.data;
      setSubject(found);

      const [examRes, marksRes] = await Promise.all([
        apiRequest<{ data: Exam }>(`/api/v1/exams/${found.examId}`, { auth }),
        apiRequest<{ data: MarkRow[] }>(`/api/v1/exam-subjects/${examSubjectId}/marks`, {
          auth,
        }),
      ]);
      setExamName(examRes.data.name);

      const enrollRes = await apiRequest<{ data: Enrollment[] }>(
        `/api/v1/enrollments?classId=${encodeURIComponent(examRes.data.classId)}&status=active&limit=100`,
        { auth },
      );

      const markMap = new Map((marksRes.data ?? []).map((m) => [m.studentId, m] as const));
      const next: Draft[] = [];
      for (const en of enrollRes.data ?? []) {
        let displayName = en.studentId;
        try {
          const st = await apiRequest<{ data: Student }>(`/api/v1/students/${en.studentId}`, {
            auth,
          });
          displayName = st.data.displayName;
        } catch {
          // id fallback
        }
        const existing = markMap.get(en.studentId);
        next.push({
          studentId: en.studentId,
          displayName,
          score:
            existing?.score === null || existing?.score === undefined ? '' : String(existing.score),
        });
      }
      setDrafts(next);
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not load marks.');
    } finally {
      setLoading(false);
    }
  }, [examSubjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    const auth = readSession();
    if (auth === null || locked) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `marks.upsert:${examSubjectId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/exam-subjects/${examSubjectId}/marks`, {
        method: 'PUT',
        auth,
        body: {
          records: drafts.map((d) => ({
            studentId: d.studentId,
            score: d.score.trim() === '' ? null : Number(d.score),
          })),
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Marks saved.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    const auth = readSession();
    if (auth === null || locked) return;
    if (!window.confirm('Submit marks? You will not be able to edit after submit.')) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/exam-subjects/${examSubjectId}/submit`, {
        method: 'POST',
        auth,
      });
      setInfo('Submitted for approval.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Submit failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onApprove() {
    const auth = readSession();
    if (auth === null || !canApprove) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/exam-subjects/${examSubjectId}/approve`, {
        method: 'POST',
        auth,
      });
      setInfo('Marks approved.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Approve failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeacherShell tenantId={tenantId}>
      <h1>Enter marks</h1>
      <p className="muted">
        {examName}
        {subject !== null ? (
          <>
            {' '}
            · max {String(subject.maxScore)} ·{' '}
            <span className={`chip chip-${subject.status === 'draft' ? 'open' : 'closed'}`}>
              {subject.status}
            </span>
          </>
        ) : null}
      </p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      {info !== null ? (
        <div className="banner banner-info" role="status">
          {info}
        </div>
      ) : null}
      {loading ? <p className="muted">Loading roster…</p> : null}
      {!loading && drafts.length === 0 ? (
        <div className="banner banner-warn">No active enrollments for this class.</div>
      ) : null}

      <ul className="list">
        {drafts.map((d) => (
          <li key={d.studentId} className="mark-row">
            <div>
              <strong>{d.displayName}</strong>
              <div className="muted">{d.studentId}</div>
            </div>
            <div className="field" style={{ margin: 0, minWidth: '6rem' }}>
              <label htmlFor={`score-${d.studentId}`}>Score</label>
              <input
                id={`score-${d.studentId}`}
                type="number"
                min={0}
                step="0.01"
                disabled={locked || busy}
                value={d.score}
                onChange={(e) => {
                  const value = e.target.value;
                  setDrafts((prev) =>
                    prev.map((row) =>
                      row.studentId === d.studentId ? { ...row, score: value } : row,
                    ),
                  );
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="bottom-bar actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={locked || busy || drafts.length === 0}
          onClick={() => void onSave()}
        >
          Save marks
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={locked || busy}
          onClick={() => void onSubmit()}
        >
          Submit
        </button>
        {canApprove ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void onApprove()}
          >
            Approve
          </button>
        ) : null}
      </div>
    </TeacherShell>
  );
}
