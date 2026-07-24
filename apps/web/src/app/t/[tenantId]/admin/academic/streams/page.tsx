'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import {
  type ClassRow,
  type LifecycleStatus,
  type StreamRow,
  LIFECYCLE_STATUSES,
  academicMessage,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminStreamsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const [rows, setRows] = useState<StreamRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [filterClassId, setFilterClassId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState<LifecycleStatus>('active');

  async function load(classFilter: string) {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const classRes = await apiRequest<{ data: ClassRow[] }>('/api/v1/classes?limit=100', {
        auth,
      });
      const classList = classRes.data ?? [];
      setClasses(classList);
      const map: Record<string, string> = {};
      for (const c of classList) map[c.id] = c.name;
      setClassNames(map);

      const q =
        classFilter !== ''
          ? `/api/v1/streams?limit=50&classId=${encodeURIComponent(classFilter)}`
          : '/api/v1/streams?limit=50';
      const streamRes = await apiRequest<{ data: StreamRow[] }>(q, { auth });
      setRows(streamRes.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not load streams.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(filterClassId);
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
      if (err instanceof ApiClientError) setError(academicMessage(err));
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

      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <div className="banner banner-info">No streams yet.</div>
      ) : null}
      <ul className="list">
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
      </ul>
    </AdminShell>
  );
}
