'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { ConfirmDialog, ResourceListPagination } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { DeleteDependentsBanner } from '@/components/DeleteDependentsBanner';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { type DependentGroup, parseDeleteDependents } from '@/lib/academic/dependents';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import {
  type AcademicYearRow,
  type LifecycleStatus,
  type TermRow,
  LIFECYCLE_STATUSES,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type ConfirmKind = 'close' | 'delete';

export default function AdminTermDetailPage() {
  const params = useParams<{ tenantId: string; termId: string }>();
  const { tenantId, termId } = params;
  const router = useRouter();
  const [row, setRow] = useState<TermRow | null>(null);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [yearsCursor, setYearsCursor] = useState<string | null>(null);
  const [loadingMoreYears, setLoadingMoreYears] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [status, setStatus] = useState<LifecycleStatus>('draft');
  const [academicYearId, setAcademicYearId] = useState('');
  const [deleteDependents, setDeleteDependents] = useState<DependentGroup[] | null>(null);

  const loadYearPicker = useCallback(
    async (opts: { readonly cursor: string | null; readonly append: boolean }) => {
      const auth = readSession();
      if (auth === null) return;
      if (opts.append) setLoadingMoreYears(true);
      try {
        const result = await apiRequest<PaginatedEnvelope<AcademicYearRow>>(
          buildListQuery('/api/v1/academic-years', {
            limit: ADMIN_LIST_DEFAULT_LIMIT,
            cursor: opts.cursor,
          }),
          { auth },
        );
        const page = readPageMeta(result);
        const list = result.data ?? [];
        setYears((prev) => (opts.append ? appendById(prev, list) : [...list]));
        setYearsCursor(page.nextCursor);
      } catch {
        if (!opts.append) {
          setYears([]);
          setYearsCursor(null);
        }
      } finally {
        setLoadingMoreYears(false);
      }
    },
    [],
  );

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const result = await apiRequest<{ data: TermRow }>(`/api/v1/terms/${termId}`, { auth });
      setRow(result.data);
      setName(result.data.name);
      setCode(result.data.code ?? '');
      setStartsOn(result.data.startsOn ?? '');
      setEndsOn(result.data.endsOn ?? '');
      setStatus(result.data.status as LifecycleStatus);
      setAcademicYearId(result.data.academicYearId);
      setError(null);
      await loadYearPicker({ cursor: null, append: false });
      try {
        const year = await apiRequest<{ data: AcademicYearRow }>(
          `/api/v1/academic-years/${result.data.academicYearId}`,
          { auth },
        );
        setYears((prev) => appendById(prev, [year.data]));
      } catch {
        /* picker may already include year */
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not load term.');
    }
  }, [loadYearPicker, termId]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSave(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || row === null) return;
    if (status === 'closed' && row.status !== 'closed') {
      setConfirm('close');
      return;
    }
    void runSave();
  }

  async function runSave() {
    const auth = readSession();
    if (auth === null || row === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `term.patch:${termId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: TermRow }>(`/api/v1/terms/${termId}`, {
        method: 'PATCH',
        auth,
        body: {
          name: name.trim(),
          code: code.trim() === '' ? null : code.trim(),
          startsOn: startsOn === '' ? null : startsOn,
          endsOn: endsOn === '' ? null : endsOn,
          status,
          academicYearId,
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setConfirm(null);
      setInfo('Term updated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not update term.');
    } finally {
      setBusy(false);
    }
  }

  async function runDelete() {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    setDeleteDependents(null);
    try {
      await apiRequest<void>(`/api/v1/terms/${termId}`, { method: 'DELETE', auth });
      setConfirm(null);
      router.push(`/t/${tenantId}/admin/academic/terms`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setDeleteDependents(parseDeleteDependents(err));
        setError(adminFriendlyMessage(err, 'academic'));
      } else setError('Could not delete term.');
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic/terms`}>← Terms</Link>
      </p>
      <h1>{row?.name ?? 'Term'}</h1>
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
        <form className="card stack" onSubmit={onSave}>
          <label className="field">
            <span>Academic year</span>
            <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
            <ResourceListPagination
              nextCursor={yearsCursor}
              loadingMore={loadingMoreYears}
              onLoadMore={() => {
                void loadYearPicker({ cursor: yearsCursor, append: true });
              }}
            />
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
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setConfirm('delete')}
            disabled={busy}
          >
            Delete
          </button>
        </form>
      ) : error === null ? (
        <p className="muted">Loading…</p>
      ) : null}

      <ConfirmDialog
        open={confirm === 'close'}
        title="Mark term as closed?"
        body="Mark this term as closed?"
        confirmLabel="Mark closed"
        danger
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirm(null);
        }}
        onConfirm={() => {
          void runSave();
        }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete term?"
        body="Delete this term? This only works if nothing depends on it."
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirm(null);
        }}
        onConfirm={() => {
          void runDelete();
        }}
      />
    </AdminShell>
  );
}
