'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { TeacherShell } from '@/components/TeacherShell';
import {
  type AttendanceRecordStatus,
  buildUpsertPayload,
  mergeRosterWithRecords,
  type MarkDraft,
  setStudentStatus,
} from '@/lib/attendance/mark-state';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type Session = {
  readonly id: string;
  readonly classId: string;
  readonly streamId: string | null;
  readonly sessionDate: string;
  readonly status: string;
};

type Enrollment = { readonly studentId: string; readonly status: string };
type RecordRow = { readonly studentId: string; readonly status: string };
type Student = { readonly id: string; readonly displayName: string };

const STATUSES: readonly AttendanceRecordStatus[] = ['present', 'absent', 'late', 'excused'];

export default function MarkSessionPage() {
  const params = useParams<{ tenantId: string; sessionId: string }>();
  const { tenantId, sessionId } = params;
  const [session, setSession] = useState<Session | null>(null);
  const [drafts, setDrafts] = useState<MarkDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const closed = session?.status === 'closed';

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    setError(null);
    try {
      const sessionRes = await apiRequest<{ data: Session }>(
        `/api/v1/attendance-sessions/${sessionId}`,
        { auth },
      );
      const sess = sessionRes.data;
      setSession(sess);

      const enrollQs = new URLSearchParams({
        classId: sess.classId,
        status: 'active',
        limit: '100',
      });
      if (sess.streamId !== null) enrollQs.set('streamId', sess.streamId);

      const [enrollRes, recordsRes] = await Promise.all([
        apiRequest<{ data: Enrollment[] }>(`/api/v1/enrollments?${enrollQs.toString()}`, { auth }),
        apiRequest<{ data: RecordRow[] }>(`/api/v1/attendance-sessions/${sessionId}/records`, {
          auth,
        }),
      ]);

      const enrollments = enrollRes.data ?? [];
      const names: Record<string, string> = {};
      await Promise.all(
        enrollments.map(async (e) => {
          try {
            const st = await apiRequest<{ data: Student }>(`/api/v1/students/${e.studentId}`, {
              auth,
            });
            names[e.studentId] = st.data.displayName;
          } catch {
            names[e.studentId] = e.studentId;
          }
        }),
      );

      setDrafts(
        mergeRosterWithRecords({
          enrollments,
          records: recordsRes.data ?? [],
          names,
        }),
      );
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Could not load session.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    const auth = readSession();
    if (auth === null || closed) return;
    if (drafts.length === 0) {
      setError('No enrolled students to mark.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `records.upsert:${sessionId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/attendance-sessions/${sessionId}/records`, {
        method: 'PUT',
        auth,
        body: buildUpsertPayload(drafts),
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

  async function onClose() {
    const auth = readSession();
    if (auth === null || closed) return;
    if (!window.confirm('Close this session? Marks cannot be edited after closing.')) return;
    setBusy(true);
    setError(null);
    const actionKey = `session.close:${sessionId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const result = await apiRequest<{ data: Session }>(
        `/api/v1/attendance-sessions/${sessionId}/close`,
        { method: 'POST', auth, idempotencyKey: idem },
      );
      clearIdempotencyKey(actionKey);
      setSession(result.data);
      setInfo('Session closed.');
    } catch (err) {
      if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
      else setError('Close failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeacherShell tenantId={tenantId}>
      <h1>Mark attendance</h1>
      {session !== null ? (
        <p className="muted">
          {session.sessionDate} · class {session.classId} ·{' '}
          <span className={`chip chip-${session.status === 'open' ? 'open' : 'closed'}`}>
            {session.status}
          </span>
        </p>
      ) : null}
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
            <div
              className="status-group"
              role="radiogroup"
              aria-label={`Status for ${d.displayName}`}
            >
              {STATUSES.map((status) => (
                <label key={status}>
                  <input
                    type="radio"
                    name={`status-${d.studentId}`}
                    value={status}
                    checked={d.status === status}
                    disabled={closed || busy}
                    onChange={() =>
                      setDrafts((prev) => setStudentStatus(prev, d.studentId, status))
                    }
                  />
                  <span>{status}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className="bottom-bar actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={closed || busy || drafts.length === 0}
          onClick={() => void onSave()}
        >
          {busy ? 'Working…' : 'Save marks'}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={closed || busy}
          onClick={() => void onClose()}
        >
          Close session
        </button>
      </div>
    </TeacherShell>
  );
}
