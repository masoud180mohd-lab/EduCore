'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import {
  type ClassRow,
  type EnrollmentRow,
  type EnrollmentStatus,
  type StreamRow,
  ENROLLMENT_STATUSES,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type ConfirmState = { readonly kind: 'status' } | { readonly kind: 'transfer' } | null;

export default function AdminEnrollmentDetailPage() {
  const params = useParams<{ tenantId: string; enrollmentId: string }>();
  const { tenantId, enrollmentId } = params;
  const [row, setRow] = useState<EnrollmentRow | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [status, setStatus] = useState<EnrollmentStatus>('active');
  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');

  const loadStreams = useCallback(async (forClassId: string) => {
    const auth = readSession();
    if (auth === null || forClassId === '') {
      setStreams([]);
      return;
    }
    try {
      const res = await apiRequest<{ data: StreamRow[] }>(
        `/api/v1/streams?limit=100&classId=${encodeURIComponent(forClassId)}`,
        { auth },
      );
      setStreams(res.data ?? []);
    } catch {
      setStreams([]);
    }
  }, []);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const [enrollRes, classRes] = await Promise.all([
        apiRequest<{ data: EnrollmentRow }>(`/api/v1/enrollments/${enrollmentId}`, { auth }),
        apiRequest<{ data: ClassRow[] }>('/api/v1/classes?limit=100', { auth }),
      ]);
      const data = enrollRes.data;
      setRow(data);
      setStatus(data.status as EnrollmentStatus);
      setClassId(data.classId);
      setStreamId(data.streamId ?? '');
      setClasses(classRes.data ?? []);
      setError(null);
      await loadStreams(data.classId);
      try {
        const st = await apiRequest<{ data: { displayName: string } }>(
          `/api/v1/students/${data.studentId}`,
          { auth },
        );
        setStudentName(st.data.displayName);
      } catch {
        setStudentName(data.studentId);
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not load enrollment.');
    }
  }, [enrollmentId, loadStreams]);

  useEffect(() => {
    void load();
  }, [load]);

  function onStatus(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || row === null) return;
    setConfirm({ kind: 'status' });
  }

  async function runStatusUpdate() {
    const auth = readSession();
    if (auth === null || row === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `enrollment.patch.status:${enrollmentId}:${status}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: EnrollmentRow }>(`/api/v1/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        auth,
        body: { status },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setConfirm(null);
      setInfo('Status updated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not update status.');
    } finally {
      setBusy(false);
    }
  }

  function onTransfer(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || row === null || classId === '') return;
    setConfirm({ kind: 'transfer' });
  }

  async function runTransfer() {
    const auth = readSession();
    if (auth === null || row === null || classId === '') return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `enrollment.patch.transfer:${enrollmentId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: EnrollmentRow }>(`/api/v1/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        auth,
        body: {
          classId,
          streamId: streamId === '' ? null : streamId,
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setConfirm(null);
      setInfo('Enrollment transferred.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not transfer enrollment.');
    } finally {
      setBusy(false);
    }
  }

  const transferClassName = classes.find((c) => c.id === classId)?.name ?? 'the selected class';
  const transferStreamName =
    streamId === ''
      ? null
      : (streams.find((s) => s.id === streamId)?.name ?? 'the selected stream');

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
            <div className="muted">Year id: {row.academicYearId}</div>
            <div className="muted">Id: {row.id}</div>
          </div>

          <form className="stack card" onSubmit={onTransfer}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Transfer class / stream</h2>
            <p className="muted">
              Moves this enrollment in place (same id). Year and term update from the target class.
            </p>
            <div className="field">
              <label htmlFor="enroll-class">Class</label>
              <select
                id="enroll-class"
                required
                value={classId}
                onChange={(e) => {
                  const next = e.target.value;
                  setClassId(next);
                  setStreamId('');
                  void loadStreams(next);
                }}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="enroll-stream">Stream (optional)</label>
              <select
                id="enroll-stream"
                value={streamId}
                onChange={(e) => setStreamId(e.target.value)}
              >
                <option value="">None</option>
                {streams.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || classId === ''}>
              {busy ? 'Saving…' : 'Transfer'}
            </button>
          </form>

          <form className="stack card" onSubmit={onStatus}>
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

      <ConfirmDialog
        open={confirm?.kind === 'status'}
        title="Change enrollment status?"
        body={`Change enrollment status to “${status}”?`}
        confirmLabel="Update status"
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirm(null);
        }}
        onConfirm={() => {
          void runStatusUpdate();
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'transfer'}
        title="Transfer enrollment?"
        body={
          transferStreamName === null
            ? `Transfer this enrollment to ${transferClassName}? Year and term will update from the target class.`
            : `Transfer this enrollment to ${transferClassName} (${transferStreamName})? Year and term will update from the target class.`
        }
        confirmLabel="Transfer"
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirm(null);
        }}
        onConfirm={() => {
          void runTransfer();
        }}
      />
    </AdminShell>
  );
}
