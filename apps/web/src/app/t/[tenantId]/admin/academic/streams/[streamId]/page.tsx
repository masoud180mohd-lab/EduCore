'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { DeleteDependentsBanner } from '@/components/DeleteDependentsBanner';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { type DependentGroup, parseDeleteDependents } from '@/lib/academic/dependents';
import {
  type ClassRow,
  type LifecycleStatus,
  type StreamRow,
  LIFECYCLE_STATUSES,
  academicMessage,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminStreamDetailPage() {
  const params = useParams<{ tenantId: string; streamId: string }>();
  const { tenantId, streamId } = params;
  const router = useRouter();
  const [row, setRow] = useState<StreamRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<LifecycleStatus>('draft');
  const [classId, setClassId] = useState('');
  const [deleteDependents, setDeleteDependents] = useState<DependentGroup[] | null>(null);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const [result, classRes] = await Promise.all([
        apiRequest<{ data: StreamRow }>(`/api/v1/streams/${streamId}`, { auth }),
        apiRequest<{ data: ClassRow[] }>('/api/v1/classes?limit=50', { auth }),
      ]);
      setRow(result.data);
      setName(result.data.name);
      setCode(result.data.code ?? '');
      setStatus(result.data.status as LifecycleStatus);
      setClassId(result.data.classId);
      setClasses(classRes.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not load stream.');
    }
  }, [streamId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || row === null) return;
    if (status === 'closed' && row.status !== 'closed') {
      if (!window.confirm('Mark this stream as closed?')) return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `stream.patch:${streamId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: StreamRow }>(`/api/v1/streams/${streamId}`, {
        method: 'PATCH',
        auth,
        body: {
          name: name.trim(),
          code: code.trim() === '' ? null : code.trim(),
          status,
          classId,
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Stream updated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not update stream.');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    const auth = readSession();
    if (auth === null) return;
    if (!window.confirm('Delete this stream? This only works if nothing depends on it.')) {
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    setDeleteDependents(null);
    try {
      await apiRequest<void>(`/api/v1/streams/${streamId}`, { method: 'DELETE', auth });
      router.push(`/t/${tenantId}/admin/academic/streams`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setDeleteDependents(parseDeleteDependents(err));
        setError(academicMessage(err));
      } else setError('Could not delete stream.');
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic/streams`}>← Streams</Link>
      </p>
      <h1>{row?.name ?? 'Stream'}</h1>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      {deleteDependents !== null ? (
        <DeleteDependentsBanner tenantId={tenantId} groups={deleteDependents} />
      ) : null}
      {info !== null ? (
        <div className="banner banner-info" role="status">
          {info}
        </div>
      ) : null}
      {row !== null ? (
        <form className="card stack" onSubmit={(e) => void onSave(e)}>
          <label className="field">
            <span>Class</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
            />
          </label>
          <label className="field">
            <span>Code (optional)</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <label className="field">
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as LifecycleStatus)}>
              {LIFECYCLE_STATUSES.map((s) => (
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
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void onDelete()}
            disabled={busy}
          >
            Delete
          </button>
        </form>
      ) : error === null ? (
        <p className="muted">Loading…</p>
      ) : null}
    </AdminShell>
  );
}
