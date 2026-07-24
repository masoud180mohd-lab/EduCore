'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import {
  type EnrollmentRow,
  type EnrollmentStatus,
  ENROLLMENT_STATUSES,
  academicMessage,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminEnrollmentDetailPage() {
  const params = useParams<{ tenantId: string; enrollmentId: string }>();
  const { tenantId, enrollmentId } = params;
  const [row, setRow] = useState<EnrollmentRow | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [className, setClassName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<EnrollmentStatus>('active');

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const result = await apiRequest<{ data: EnrollmentRow }>(
        `/api/v1/enrollments/${enrollmentId}`,
        { auth },
      );
      setRow(result.data);
      setStatus(result.data.status as EnrollmentStatus);
      setError(null);
      try {
        const st = await apiRequest<{ data: { displayName: string } }>(
          `/api/v1/students/${result.data.studentId}`,
          { auth },
        );
        setStudentName(st.data.displayName);
      } catch {
        setStudentName(result.data.studentId);
      }
      try {
        const cl = await apiRequest<{ data: { name: string } }>(
          `/api/v1/classes/${result.data.classId}`,
          { auth },
        );
        setClassName(cl.data.name);
      } catch {
        setClassName(result.data.classId);
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not load enrollment.');
    }
  }, [enrollmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onStatus(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || row === null) return;
    if (!window.confirm(`Change enrollment status to “${status}”?`)) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `enrollment.patch:${enrollmentId}:${status}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: EnrollmentRow }>(`/api/v1/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        auth,
        body: { status },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Status updated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not update status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic/enrollments`}>← Enrollments</Link>
      </p>
      <h1>{studentName ?? 'Enrollment'}</h1>
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
      {row !== null ? (
        <div className="stack">
          <div className="card stack">
            <div>
              <span className="chip">{row.status}</span>
            </div>
            <div className="muted">Student: {studentName ?? row.studentId}</div>
            <div className="muted">Class: {className ?? row.classId}</div>
            <div className="muted">Stream id: {row.streamId ?? '—'}</div>
            <div className="muted">Year id: {row.academicYearId}</div>
            <div className="muted">Id: {row.id}</div>
            <p className="muted">
              Class/stream cannot be changed here — withdraw and create a new enrollment if needed.
            </p>
          </div>

          <form className="stack card" onSubmit={(e) => void onStatus(e)}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Change status</h2>
            <div className="field">
              <label htmlFor="enroll-patch-status">Status</label>
              <select
                id="enroll-patch-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as EnrollmentStatus)}
              >
                {ENROLLMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Update status'}
            </button>
          </form>
        </div>
      ) : error === null ? (
        <p className="muted">Loading…</p>
      ) : null}
    </AdminShell>
  );
}
