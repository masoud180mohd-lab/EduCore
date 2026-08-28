'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner, ConfirmDialog, ResourceListPagination } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
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
  type StreamRow,
  type TermRow,
  LIFECYCLE_STATUSES,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type ConfirmKind = 'close' | 'delete';

export default function AdminClassDetailPage() {
  const params = useParams<{ tenantId: string; classId: string }>();
  const { tenantId, classId } = params;
  const router = useRouter();
  const { t } = useAppPreferences();
  const [row, setRow] = useState<ClassRow | null>(null);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [yearsCursor, setYearsCursor] = useState<string | null>(null);
  const [loadingMoreYears, setLoadingMoreYears] = useState(false);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [termsCursor, setTermsCursor] = useState<string | null>(null);
  const [loadingMoreTerms, setLoadingMoreTerms] = useState(false);
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [newStreamName, setNewStreamName] = useState('');
  const [newStreamCode, setNewStreamCode] = useState('');
  const [addingStream, setAddingStream] = useState(false);
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

      try {
        const streamsRes = await apiRequest<PaginatedEnvelope<StreamRow>>(
          buildListQuery('/api/v1/streams', { limit: 100, filters: { classId } }),
          { auth },
        );
        setStreams([...(streamsRes.data ?? [])]);
      } catch {
        /* streams list might be empty */
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

  async function onAddStream(e: FormEvent) {
    e.preventDefault();
    const auth = readSession();
    if (auth === null || newStreamName.trim() === '') return;
    setAddingStream(true);
    setError(null);
    setInfo(null);
    const actionKey = `stream.create:${classId}:${newStreamName}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest('/api/v1/streams', {
        method: 'POST',
        auth,
        body: {
          classId,
          name: newStreamName.trim(),
          code: newStreamCode.trim() === '' ? undefined : newStreamCode.trim(),
          status: 'active',
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setNewStreamName('');
      setNewStreamCode('');
      setInfo('Mkondo umeongezwa kikamilifu.');
      const streamsRes = await apiRequest<PaginatedEnvelope<StreamRow>>(
        buildListQuery('/api/v1/streams', { limit: 100, filters: { classId } }),
        { auth },
      );
      setStreams([...(streamsRes.data ?? [])]);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Imeshindikana kuongeza mkondo.');
    } finally {
      setAddingStream(false);
    }
  }

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
      setInfo('Mabadiliko yamehifadhiwa.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not save class.');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function runDelete() {
    const auth = readSession();
    if (auth === null || row === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    setDeleteDependents(null);
    const actionKey = `class.delete:${classId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/classes/${classId}`, {
        method: 'DELETE',
        auth,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      router.push(`/t/${tenantId}/admin/academic/classes`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        const dependents = parseDeleteDependents(err);
        if (dependents !== null) {
          setDeleteDependents(dependents);
          setError('Imeshindikana kufuta darasa hili kwa kuwa lina taarifa zinazolitegemea.');
        } else {
          setError(adminFriendlyMessage(err, 'academic'));
        }
      } else {
        setError('Could not delete class.');
      }
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic/classes`}>← {t('academic.classes')}</Link>
      </p>
      <AdminPageHeader
        title={row?.name ?? t('common.loading')}
        description={t('academic.classes')}
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {deleteDependents !== null ? (
        <DeleteDependentsBanner tenantId={tenantId} groups={deleteDependents} />
      ) : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}
      {row !== null ? (
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          {/* Class edit form */}
          <form className="card stack" onSubmit={onSave}>
            <h3 className="section-title">Taarifa za Darasa</h3>
            <label className="field">
              <span>{t('academic.year')}</span>
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
              <span>{t('common.term')}</span>
              <select value={termId} onChange={(e) => setTermId(e.target.value)}>
                <option value="">None</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
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
              <span>{t('common.name')}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label className="field">
              <span>{t('common.codeOptional')}</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <label className="field">
              <span>{t('common.status')}</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as LifecycleStatus)}>
                {LIFECYCLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2 pt-2">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? t('common.saving') : t('common.save')}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setConfirm('delete')}
                disabled={busy}
              >
                {t('common.delete')}
              </button>
            </div>
          </form>

          {/* Streams for this class */}
          <div className="stack">
            <div className="card stack">
              <div className="flex items-center justify-between">
                <h3 className="section-title">Mikondo ya Darasa (Streams)</h3>
                <Link
                  className="text-xs font-semibold text-primary hover:underline"
                  href={`/t/${tenantId}/admin/academic/streams`}
                >
                  Tazama yote →
                </Link>
              </div>

              {streams.length === 0 ? (
                <p className="text-xs text-muted-foreground">Hakuna mikondo iliyoongezwa kwenye darasa hili bado.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {streams.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <Link
                          href={`/t/${tenantId}/admin/academic/streams/${s.id}`}
                          className="text-sm font-semibold hover:underline text-primary"
                        >
                          {s.name}
                        </Link>
                        {s.code && <span className="ml-2 text-xs font-mono text-muted-foreground">({s.code})</span>}
                      </div>
                      <Link
                        className="btn btn-secondary text-xs"
                        href={`/t/${tenantId}/admin/academic/streams/${s.id}`}
                      >
                        {t('common.open')}
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {/* Inline Add Stream */}
              <form onSubmit={onAddStream} className="pt-3 border-t border-border/60 stack">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ongeza Mkondo Mpya (k.m. A, B, au C)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Jina la Mkondo (mfano: A)"
                    required
                    value={newStreamName}
                    onChange={(e) => setNewStreamName(e.target.value)}
                    className="text-sm"
                  />
                  <input
                    placeholder="Code (hiari)"
                    value={newStreamCode}
                    onChange={(e) => setNewStreamCode(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <button type="submit" className="btn btn-secondary text-xs" disabled={addingStream || newStreamName.trim() === ''}>
                  {addingStream ? 'Inaongeza...' : '+ Ongeza Mkondo'}
                </button>
              </form>
            </div>

            <div className="card flex items-center justify-between p-4">
              <div>
                <h4 className="text-sm font-bold">Wanafunzi wa Darasa Hili</h4>
                <p className="text-xs text-muted-foreground">Tazama wanafunzi waliosajiliwa au sajili wapya.</p>
              </div>
              <Link
                className="btn btn-secondary text-xs"
                href={`/t/${tenantId}/admin/academic/enrollments?classId=${classId}`}
              >
                {t('academic.enrollments')} →
              </Link>
            </div>
          </div>
        </div>
      ) : error === null ? (
        <p className="muted">{t('common.loading')}</p>
      ) : null}

      <ConfirmDialog
        open={confirm === 'close'}
        title={t('academic.closeClass')}
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
        title={t('academic.deleteClass')}
        body="Delete this class? This only works if nothing depends on it."
        confirmLabel={t('common.delete')}
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
