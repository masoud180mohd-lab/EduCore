'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { DeleteDependentsBanner } from '@/components/DeleteDependentsBanner';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { type DependentGroup, parseDeleteDependents } from '@/lib/academic/dependents';
import {
  type AcademicYearRow,
  type ClassRow,
  type LifecycleStatus,
  type TermRow,
  LIFECYCLE_STATUSES,
  academicMessage,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminClassDetailPage() {
  const params = useParams<{ tenantId: string; classId: string }>();
  const { tenantId, classId } = params;
  const router = useRouter();
  const [row, setRow] = useState<ClassRow | null>(null);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<LifecycleStatus>('draft');
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [deleteDependents, setDeleteDependents] = useState<DependentGroup[] | null>(null);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const [result, yearRes] = await Promise.all([
        apiRequest<{ data: ClassRow }>(`/api/v1/classes/${classId}`, { auth }),
        apiRequest<{ data: AcademicYearRow[] }>('/api/v1/academic-years?limit=50', { auth }),
      ]);
      setRow(result.data);
      setName(result.data.name);
      setCode(result.data.code ?? '');
      setStatus(result.data.status as LifecycleStatus);
      setAcademicYearId(result.data.academicYearId);
      setTermId(result.data.termId ?? '');
      setYears(yearRes.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not load class.');
    }
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const auth = readSession();
    if (auth === null || academicYearId === '') {
      setTerms([]);
      return;
    }
    void (async () => {
      try {
        const termRes = await apiRequest<{ data: TermRow[] }>(
          `/api/v1/terms?limit=50&academicYearId=${encodeURIComponent(academicYearId)}`,
          { auth },
        );
        setTerms(termRes.data ?? []);
      } catch {
        setTerms([]);
      }
    })();
  }, [academicYearId]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || row === null) return;
    if (status === 'closed' && row.status !== 'closed') {
      if (!window.confirm('Mark this class as closed?')) return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `class.patch:${classId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: ClassRow }>(`/api/v1/classes/${classId}`, {
        method: 'PATCH',
        auth,
        body: {
          name: name.trim(),
          code: code.trim() === '' ? null : code.trim(),
          status,
          academicYearId,
          termId: termId === '' ? null : termId,
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Class updated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not update class.');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    const auth = readSession();
    if (auth === null) return;
    if (!window.confirm('Delete this class? This only works if nothing depends on it.')) {
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    setDeleteDependents(null);
    try {
      await apiRequest<void>(`/api/v1/classes/${classId}`, { method: 'DELETE', auth });
      router.push(`/t/${tenantId}/admin/academic/classes`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setDeleteDependents(parseDeleteDependents(err));
        setError(academicMessage(err));
      } else setError('Could not delete class.');
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic/classes`}>← Classes</Link>
      </p>
      <h1>{row?.name ?? 'Class'}</h1>
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
        <div className="stack">
          <form className="card stack" onSubmit={(e) => void onSave(e)}>
            <label className="field">
              <span>Academic year</span>
              <select
                value={academicYearId}
                onChange={(e) => {
                  setAcademicYearId(e.target.value);
                  setTermId('');
                }}
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Term (optional)</span>
              <select value={termId} onChange={(e) => setTermId(e.target.value)}>
                <option value="">None</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
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
          <p>
            <Link className="btn btn-secondary" href={`/t/${tenantId}/admin/academic/streams`}>
              Manage streams
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
