'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { ResourceList, ResourceListPagination } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
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
  type LifecycleStatus,
  type StreamRow,
  LIFECYCLE_STATUSES,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminStreamsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const [rows, setRows] = useState<StreamRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classesCursor, setClassesCursor] = useState<string | null>(null);
  const [loadingMoreClasses, setLoadingMoreClasses] = useState(false);
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [filterClassId, setFilterClassId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState<LifecycleStatus>('active');

  async function loadClassPicker(opts: { readonly cursor: string | null; readonly append: boolean }) {
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
      setClassNames((prev) => {
        const next = opts.append ? { ...prev } : {};
        for (const c of list) next[c.id] = c.name;
        return next;
      });
    } catch {
      if (!opts.append) {
        setClasses([]);
        setClassesCursor(null);
      }
    } finally {
      setLoadingMoreClasses(false);
    }
  }

  async function loadPage(opts: {
    readonly classFilter: string;
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/streams', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
        filters: { classId: opts.classFilter === '' ? undefined : opts.classFilter },
      });
      const result = await apiRequest<PaginatedEnvelope<StreamRow>>(q, { auth });
      const page = readPageMeta(result);
      setRows((prev) =>
        opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not load streams.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadClassPicker({ cursor: null, append: false });
  }, []);

  useEffect(() => {
    void loadPage({ classFilter: filterClassId, cursor: null, append: false });
  }, [filterClassId]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || classId === '') return;
    setBusy(true);
    setError(null);
    const actionKey = `stream.create:${classId}:${name}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, string> = { classId, name: name.trim(), status };
      if (code.trim() !== '') body['code'] = code.trim();
      const created = await apiRequest<{ data: StreamRow }>('/api/v1/streams', {
        method: 'POST',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setName('');
      setCode('');
      router.push(`/t/${tenantId}/admin/academic/streams/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not create stream.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic`}>← Academic</Link>
      </p>
      <h1>Streams</h1>
      <p className="muted">Streams belong to a class (ACF-006).</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="filter-class">Filter by class</label>
        <select
          id="filter-class"
          value={filterClassId}
          onChange={(e) => setFilterClassId(e.target.value)}
        >
          <option value="">All classes</option>
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

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Create stream</h2>
        <div className="field">
          <label htmlFor="stream-class">Class</label>
          <select
            id="stream-class"
            required
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">Select class</option>
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
          <label htmlFor="stream-name">Name</label>
          <input
            id="stream-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="field">
          <label htmlFor="stream-code">Code (optional)</label>
          <input id="stream-code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="stream-status">Status</label>
          <select
            id="stream-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as LifecycleStatus)}
          >
            {LIFECYCLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || classId === ''}>
          {busy ? 'Saving…' : 'Create stream'}
        </button>
      </form>

      <ResourceList
        loading={loading}
        empty="No streams yet."
        isEmpty={rows.length === 0}
        footer={
          <ResourceListPagination
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void loadPage({ classFilter: filterClassId, cursor: nextCursor, append: true });
            }}
          />
        }
      >
        {rows.map((row) => (
          <li key={row.id}>
            <Link className="card" href={`/t/${tenantId}/admin/academic/streams/${row.id}`}>
              <strong>{row.name}</strong>
              <div className="muted">
                <span className="chip">{row.status}</span>
                {' · '}
                {classNames[row.classId] ?? row.classId}
              </div>
            </Link>
          </li>
        ))}
      </ResourceList>
    </AdminShell>
  );
}
