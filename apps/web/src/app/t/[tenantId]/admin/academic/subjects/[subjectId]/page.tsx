'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner, ConfirmDialog } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { DeleteDependentsBanner } from '@/components/DeleteDependentsBanner';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { type DependentGroup, parseDeleteDependents } from '@/lib/academic/dependents';
import { type LifecycleStatus, type SubjectRow, LIFECYCLE_STATUSES } from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type ConfirmKind = 'close' | 'delete';

export default function AdminSubjectDetailPage() {
  const params = useParams<{ tenantId: string; subjectId: string }>();
  const { tenantId, subjectId } = params;
  const router = useRouter();
  const { t } = useAppPreferences();
  const [row, setRow] = useState<SubjectRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<LifecycleStatus>('draft');
  const [deleteDependents, setDeleteDependents] = useState<DependentGroup[] | null>(null);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const result = await apiRequest<{ data: SubjectRow }>(`/api/v1/subjects/${subjectId}`, {
        auth,
      });
      setRow(result.data);
      setName(result.data.name);
      setCode(result.data.code ?? '');
      setStatus(result.data.status as LifecycleStatus);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not load subject.');
    }
  }, [subjectId]);

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
    const actionKey = `subject.patch:${subjectId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest<{ data: SubjectRow }>(`/api/v1/subjects/${subjectId}`, {
        method: 'PATCH',
        auth,
        body: {
          name: name.trim(),
          code: code.trim() === '' ? null : code.trim(),
          status,
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setConfirm(null);
      setInfo('Subject updated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not update subject.');
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
      await apiRequest<void>(`/api/v1/subjects/${subjectId}`, { method: 'DELETE', auth });
      setConfirm(null);
      router.push(`/t/${tenantId}/admin/academic/subjects`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setDeleteDependents(parseDeleteDependents(err));
        setError(adminFriendlyMessage(err, 'academic'));
      } else setError('Could not delete subject.');
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic/subjects`}>← {t('academic.subjects')}</Link>
      </p>
      <AdminPageHeader title={row?.name ?? t('academic.subject')} />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {deleteDependents !== null ? (
        <DeleteDependentsBanner tenantId={tenantId} groups={deleteDependents} />
      ) : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}
      {row !== null ? (
        <form className="card stack" onSubmit={onSave}>
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
        </form>
      ) : error === null ? (
        <p className="muted">{t('common.loading')}</p>
      ) : null}

      <ConfirmDialog
        open={confirm === 'close'}
        title={t('academic.closeSubject')}
        body="Mark this subject as closed?"
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
        title={t('academic.deleteSubject')}
        body="Delete this subject? This only works if nothing depends on it."
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
