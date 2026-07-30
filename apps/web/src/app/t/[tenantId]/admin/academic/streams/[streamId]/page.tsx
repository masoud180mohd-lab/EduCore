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
  type ClassRow,
  type LifecycleStatus,
  type StreamRow,
  LIFECYCLE_STATUSES,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

type ConfirmKind = 'close' | 'delete';

export default function AdminStreamDetailPage() {
  const params = useParams<{ tenantId: string; streamId: string }>();
  const { tenantId, streamId } = params;
  const router = useRouter();
  const [row, setRow] = useState<StreamRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classesCursor, setClassesCursor] = useState<string | null>(null);
  const [loadingMoreClasses, setLoadingMoreClasses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<LifecycleStatus>('draft');
  const [classId, setClassId] = useState('');
  const [deleteDependents, setDeleteDependents] = useState<DependentGroup[] | null>(null);

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

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const result = await apiRequest<{ data: StreamRow }>(`/api/v1/streams/${streamId}`, {
        auth,
      });
      setRow(result.data);
      setName(result.data.name);
      setCode(result.data.code ?? '');
      setStatus(result.data.status as LifecycleStatus);
      setClassId(result.data.classId);
      setError(null);
      await loadClassPicker({ cursor: null, append: false });
      try {
        const cls = await apiRequest<{ data: ClassRow }>(
          `/api/v1/classes/${result.data.classId}`,
          { auth },
        );
        setClasses((prev) => appendById(prev, [cls.data]));
      } catch {
        /* picker may already include class */
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not load stream.');
    }
  }, [loadClassPicker, streamId]);

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
      setConfirm(null);
      setInfo('Stream updated.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not update stream.');
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
      await apiRequest<void>(`/api/v1/streams/${streamId}`, { method: 'DELETE', auth });
      setConfirm(null);
      router.push(`/t/${tenantId}/admin/academic/streams`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setDeleteDependents(parseDeleteDependents(err));
        setError(adminFriendlyMessage(err, 'academic'));
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
        <form className="card stack" onSubmit={onSave}>
          <label className="field">
            <span>Class</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
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
        title="Mark stream as closed?"
        body="Mark this stream as closed?"
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
        title="Delete stream?"
        body="Delete this stream? This only works if nothing depends on it."
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
