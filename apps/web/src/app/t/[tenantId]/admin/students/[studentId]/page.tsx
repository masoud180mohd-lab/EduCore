'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { type StudentRow, type StudentStatus, STUDENT_STATUSES } from '@/lib/students/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminStudentDetailPage() {
  const params = useParams<{ tenantId: string; studentId: string }>();
  const { tenantId, studentId } = params;
  const [row, setRow] = useState<StudentRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [status, setStatus] = useState<StudentStatus>('active');

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const result = await apiRequest<{ data: StudentRow }>(`/api/v1/students/${studentId}`, {
        auth,
      });
      setRow(result.data);
      setDisplayName(result.data.displayName);
      setStudentCode(result.data.studentCode ?? '');
      setStatus(result.data.status as StudentStatus);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'students'));
      else setError('Could not load student.');
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || row === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `student.patch:${studentId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: StudentRow }>(`/api/v1/students/${studentId}`, {
        method: 'PATCH',
        auth,
        body: {
          displayName: displayName.trim(),
          studentCode: studentCode.trim() === '' ? null : studentCode.trim(),
          status,
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Student updated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'students'));
      else setError('Could not update student.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/students`}>← Students</Link>
      </p>
      <h1>{row?.displayName ?? 'Student'}</h1>
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
          <form className="card stack" onSubmit={(e) => void onSave(e)}>
            <label className="field">
              <span>Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label className="field">
              <span>Student code (optional)</span>
              <input
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                pattern="[A-Za-z0-9._-]{0,64}"
                title="Letters, numbers, . _ - up to 64 characters"
              />
            </label>
            <label className="field">
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as StudentStatus)}>
                {STUDENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div className="muted">Id: {row.id}</div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </form>
          <p className="muted">
            Link guardians under Guardians; place in a class under Academic → Enrollments.
          </p>
          <p>
            <Link className="btn btn-secondary" href={`/t/${tenantId}/admin/guardians`}>
              Guardians
            </Link>{' '}
            <Link className="btn btn-secondary" href={`/t/${tenantId}/admin/academic/enrollments`}>
              Enrollments
            </Link>
          </p>
        </div>
      ) : error === null ? (
        <p className="muted">Loading…</p>
      ) : null}
    </AdminShell>
  );
}
