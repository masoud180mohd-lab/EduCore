'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner, ConfirmDialog, ResourceListPagination } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import {
  type ClassRow,
  type EnrollmentRow,
  type EnrollmentStatus,
  type StreamRow,
  ENROLLMENT_STATUSES,
} from '@/lib/academic/types';
import { resolveYearNames } from '@/lib/admin/resolve-related-names';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type ConfirmState = { readonly kind: 'status' } | { readonly kind: 'transfer' } | null;

export default function AdminEnrollmentDetailPage() {
  const params = useParams<{ tenantId: string; enrollmentId: string }>();
  const { tenantId, enrollmentId } = params;
  const { t } = useAppPreferences();
  const [row, setRow] = useState<EnrollmentRow | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [yearName, setYearName] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classesCursor, setClassesCursor] = useState<string | null>(null);
  const [loadingMoreClasses, setLoadingMoreClasses] = useState(false);
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [streamsCursor, setStreamsCursor] = useState<string | null>(null);
  const [loadingMoreStreams, setLoadingMoreStreams] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [status, setStatus] = useState<EnrollmentStatus>('active');
  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');

  const loadClassPicker = useCallback(
    async (opts: { readonly cursor: string | null; readonly append: boolean }) => {
      const auth = readSession();
      if (auth === null) return;
      if (opts.append) setLoadingMoreClasses(true);
      try {
        const result = await apiRequest<PaginatedEnvelope<ClassRow>>(
          buildListQuery('/api/v1/classes', {
            limit: ADMIN_LIST_DEFAULT_LIMIT,
            cursor: opts.cursor,
          }),
          { auth },
        );
        const page = readPageMeta(result);
        const list = result.data ?? [];
        setClasses((prev) => (opts.append ? appendById(prev, list) : [...list]));
        setClassesCursor(page.nextCursor);
      } catch {
        if (!opts.append) {
          setClasses([]);
          setClassesCursor(null);
        }
      } finally {
        setLoadingMoreClasses(false);
      }
    },
    [],
  );

  const loadStreamPicker = useCallback(
    async (opts: {
      readonly forClassId: string;
      readonly cursor: string | null;
      readonly append: boolean;
    }) => {
      const auth = readSession();
      if (auth === null || opts.forClassId === '') {
        setStreams([]);
        setStreamsCursor(null);
        return;
      }
      if (opts.append) setLoadingMoreStreams(true);
      try {
        const result = await apiRequest<PaginatedEnvelope<StreamRow>>(
          buildListQuery('/api/v1/streams', {
            limit: ADMIN_LIST_DEFAULT_LIMIT,
            cursor: opts.cursor,
            filters: { classId: opts.forClassId },
          }),
          { auth },
        );
        const page = readPageMeta(result);
        const list = result.data ?? [];
        setStreams((prev) => (opts.append ? appendById(prev, list) : [...list]));
        setStreamsCursor(page.nextCursor);
      } catch {
        if (!opts.append) {
          setStreams([]);
          setStreamsCursor(null);
        }
      } finally {
        setLoadingMoreStreams(false);
      }
    },
    [],
  );

  const ensureClassOption = useCallback(async (id: string) => {
    const auth = readSession();
    if (auth === null || id === '') return;
    try {
      const res = await apiRequest<{ data: ClassRow }>(`/api/v1/classes/${id}`, { auth });
      setClasses((prev) => appendById(prev, [res.data]));
    } catch {
      /* keep list as-is */
    }
  }, []);

  const ensureStreamOption = useCallback(async (id: string) => {
    const auth = readSession();
    if (auth === null || id === '') return;
    try {
      const res = await apiRequest<{ data: StreamRow }>(`/api/v1/streams/${id}`, { auth });
      setStreams((prev) => appendById(prev, [res.data]));
    } catch {
      /* keep list as-is */
    }
  }, []);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const enrollRes = await apiRequest<{ data: EnrollmentRow }>(
        `/api/v1/enrollments/${enrollmentId}`,
        { auth },
      );
      const data = enrollRes.data;
      setRow(data);
      setStatus(data.status as EnrollmentStatus);
      setClassId(data.classId);
      setStreamId(data.streamId ?? '');
      setError(null);
      await loadClassPicker({ cursor: null, append: false });
      await ensureClassOption(data.classId);
      await loadStreamPicker({ forClassId: data.classId, cursor: null, append: false });
      if (data.streamId !== null) await ensureStreamOption(data.streamId);
      try {
        const st = await apiRequest<{ data: { displayName: string } }>(
          `/api/v1/students/${data.studentId}`,
          { auth },
        );
        setStudentName(st.data.displayName);
      } catch {
        setStudentName(data.studentId);
      }
      const years = await resolveYearNames(auth, [data.academicYearId]);
      setYearName(years[data.academicYearId] ?? data.academicYearId);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not load enrollment.');
    }
  }, [enrollmentId, ensureClassOption, ensureStreamOption, loadClassPicker, loadStreamPicker]);

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
        <Link href={`/t/${tenantId}/admin/academic/enrollments`}>← {t('academic.enrollments')}</Link>
      </p>
      <AdminPageHeader title={studentName ?? t('academic.enrollment')} />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}
      {row !== null ? (
        <div className="stack">
          <div className="card stack">
            <div>
              <span className="chip">{row.status}</span>
            </div>
            <div className="muted">{t('common.student')}: {studentName ?? row.studentId}</div>
            <div className="muted">{t('common.year')}: {yearName ?? row.academicYearId}</div>
          </div>

          <form className="stack card" onSubmit={onTransfer}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{t('academic.transferHeading')}</h2>
            <p className="muted">
              Moves this enrollment in place (same id). Year and term update from the target class.
            </p>
            <div className="field">
              <label htmlFor="enroll-class">{t('common.class')}</label>
              <select
                id="enroll-class"
                required
                value={classId}
                onChange={(e) => {
                  const next = e.target.value;
                  setClassId(next);
                  setStreamId('');
                  void loadStreamPicker({ forClassId: next, cursor: null, append: false });
                }}
              >
                <option value="">{t('common.select')} {t('common.class')}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ResourceListPagination
                nextCursor={classesCursor}
                loadingMore={loadingMoreClasses}
                onLoadMore={() => {
                  void loadClassPicker({ cursor: classesCursor, append: true });
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="enroll-stream">{t('common.stream')}</label>
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
              <ResourceListPagination
                nextCursor={streamsCursor}
                loadingMore={loadingMoreStreams}
                onLoadMore={() => {
                  void loadStreamPicker({
                    forClassId: classId,
                    cursor: streamsCursor,
                    append: true,
                  });
                }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || classId === ''}>
              {busy ? t('common.saving') : t('common.transfer')}
            </button>
          </form>

          <form className="stack card" onSubmit={onStatus}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{t('academic.changeStatusHeading')}</h2>
            <div className="field">
              <label htmlFor="enroll-patch-status">{t('common.status')}</label>
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
              {busy ? t('common.saving') : t('common.updateStatus')}
            </button>
          </form>
        </div>
      ) : error === null ? (
        <p className="muted">{t('common.loading')}</p>
      ) : null}

      <ConfirmDialog
        open={confirm?.kind === 'status'}
        title={t('academic.changeStatus')}
        body={t('academic.changeStatusBody', { status })}
        confirmLabel={t('common.updateStatus')}
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
        title={t('academic.transfer')}
        body={
          transferStreamName === null
            ? t('academic.transferBody', { class: transferClassName ?? '' })
            : t('academic.transferBodyStream', {
                class: transferClassName ?? '',
                stream: transferStreamName,
              })
        }
        confirmLabel={t('common.transfer')}
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
