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
  type ClassRow,
  type LifecycleStatus,
  type TermRow,
  LIFECYCLE_STATUSES,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type ConfirmKind = 'close' | 'delete';

export default function AdminClassDetailPage() {
  const params = useParams<{ tenantId: string; classId: string }>();
  const { tenantId, classId } = params;
  const router = useRouter();
  const [row, setRow] = useState<ClassRow | null>(null);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [yearsCursor, setYearsCursor] = useState<string | null>(null);
  const [loadingMoreYears, setLoadingMoreYears] = useState(false);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [termsCursor, setTermsCursor] = useState<string | null>(null);
  const [loadingMoreTerms, setLoadingMoreTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<LifecycleStatus>('draft');
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
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

  const loadTermPicker = useCallback(
    async (opts: {
      readonly forYearId: string;
      readonly cursor: string | null;
      readonly append: boolean;
    }) => {
      const auth = readSession();
      if (auth === null || opts.forYearId === '') {
        setTerms([]);
        setTermsCursor(null);
        return;
      }
      if (opts.append) setLoadingMoreTerms(true);
      try {
        const result = await apiRequest<PaginatedEnvelope<TermRow>>(
          buildListQuery('/api/v1/terms', {
            limit: ADMIN_LIST_DEFAULT_LIMIT,
            cursor: opts.cursor,
            filters: { academicYearId: opts.forYearId },
          }),
          { auth },
        );
        const page = readPageMeta(result);
        const list = result.data ?? [];
        setTerms((prev) => (opts.append ? appendById(prev, list) : [...list]));
        setTermsCursor(page.nextCursor);
      } catch {
        if (!opts.append) {
          setTerms([]);
          setTermsCursor(null);
        }
      } finally {
        setLoadingMoreTerms(false);
      }
    },
    [],
  );

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const result = await apiRequest<{ data: ClassRow }>(`/api/v1/classes/${classId}`, {
        auth,
      });
      setRow(result.data);
      setName(result.data.name);
      setCode(result.data.code ?? '');
      setStatus(result.data.status as LifecycleStatus);
      setAcademicYearId(result.data.academicYearId);
      setTermId(result.data.termId ?? '');
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
      await loadTermPicker({
        forYearId: result.data.academicYearId,
        cursor: null,
        append: false,
      });
      if (result.data.termId !== null) {
        try {
          const term = await apiRequest<{ data: TermRow }>(`/api/v1/terms/${result.data.termId}`, {
            auth,
          });
          setTerms((prev) => appendById(prev, [term.data]));
        } catch {
          /* picker may already include term */
        }
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not load class.');
    }
  }, [classId, loadTermPicker, loadYearPicker]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (row === null) return;
    if (academicYearId === row.academicYearId) return;
    setTermId('');
    void loadTermPicker({ forYearId: academicYearId, cursor: null, append: false });
  }, [academicYearId, loadTermPicker, row]);

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
      setConfirm(null);
      setInfo('Class updated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not update class.');
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
      await apiRequest<void>(`/api/v1/classes/${classId}`, { method: 'DELETE', auth });
      setConfirm(null);
      router.push(`/t/${tenantId}/admin/academic/classes`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setDeleteDependents(parseDeleteDependents(err));
        setError(adminFriendlyMessage(err, 'academic'));
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
          <form className="card stack" onSubmit={onSave}>
            <label className="field">
              <span>Academic year</span>
              <select
                value={academicYearId}
                onChange={(e) => {
                  setAcademicYearId(e.target.value);
                }}
              >
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
              <span>Term (optional)</span>
              <select value={termId} onChange={(e) => setTermId(e.target.value)}>
                <option value="">None</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ResourceListPagination
                nextCursor={termsCursor}
                loadingMore={loadingMoreTerms}
                onLoadMore={() => {
                  void loadTermPicker({
                    forYearId: academicYearId,
                    cursor: termsCursor,
                    append: true,
                  });
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

      <ConfirmDialog
        open={confirm === 'close'}
        title="Mark class as closed?"
        body="Mark this class as closed?"
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
        title="Delete class?"
        body="Delete this class? This only works if nothing depends on it."
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
