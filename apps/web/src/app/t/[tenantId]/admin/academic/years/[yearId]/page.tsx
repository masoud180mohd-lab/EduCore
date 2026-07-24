'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import {
  type AcademicYearRow,
  type LifecycleStatus,
  LIFECYCLE_STATUSES,
  academicMessage,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminAcademicYearDetailPage() {
  const params = useParams<{ tenantId: string; yearId: string }>();
  const { tenantId, yearId } = params;
  const [row, setRow] = useState<AcademicYearRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [status, setStatus] = useState<LifecycleStatus>('draft');

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const result = await apiRequest<{ data: AcademicYearRow }>(
        `/api/v1/academic-years/${yearId}`,
        { auth },
      );
      setRow(result.data);
      setName(result.data.name);
      setCode(result.data.code ?? '');
      setStartsOn(result.data.startsOn ?? '');
      setEndsOn(result.data.endsOn ?? '');
      setStatus(result.data.status as LifecycleStatus);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not load academic year.');
    }
  }, [yearId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || row === null) return;
    if (status === 'closed' && row.status !== 'closed') {
      if (!window.confirm('Mark this academic year as closed? This is for completed years.')) {
        return;
      }
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `academic-year.patch:${yearId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, string | null> = {
        name: name.trim(),
        code: code.trim() === '' ? null : code.trim(),
        startsOn: startsOn === '' ? null : startsOn,
        endsOn: endsOn === '' ? null : endsOn,
        status,
      };
      await apiRequest<{ data: AcademicYearRow }>(`/api/v1/academic-years/${yearId}`, {
        method: 'PATCH',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Academic year updated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not update academic year.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic/years`}>← Years</Link>
      </p>
      <h1>{row?.name ?? 'Academic year'}</h1>
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
              <span>Starts on</span>
              <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </label>
            <label className="field">
              <span>Ends on</span>
              <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
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
          </form>
          <p>
            <Link className="btn btn-secondary" href={`/t/${tenantId}/admin/academic/terms`}>
              Manage terms
            </Link>
          </p>
        </div>
      ) : error === null ? (
        <p className="muted">Loading…</p>
      ) : null}
    </AdminShell>
  );
}
