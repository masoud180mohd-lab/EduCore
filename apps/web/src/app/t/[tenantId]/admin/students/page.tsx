'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import {
  type StudentRow,
  type StudentStatus,
  STUDENT_STATUSES,
  studentMessage,
} from '@/lib/students/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminStudentsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [status, setStatus] = useState<StudentStatus>('active');

  async function load(searchQ: string) {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const q =
        searchQ.trim() !== ''
          ? `/api/v1/students?limit=50&search=${encodeURIComponent(searchQ.trim())}`
          : '/api/v1/students?limit=50';
      const result = await apiRequest<{ data: StudentRow[] }>(q, { auth });
      setRows(result.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(studentMessage(err));
      else setError('Could not load students.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load('');
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    const actionKey = `student.create:${displayName}:${studentCode}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, string> = {
        displayName: displayName.trim(),
        status,
      };
      if (studentCode.trim() !== '') body['studentCode'] = studentCode.trim();
      const created = await apiRequest<{ data: StudentRow }>('/api/v1/students', {
        method: 'POST',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setDisplayName('');
      setStudentCode('');
      setStatus('active');
      router.push(`/t/${tenantId}/admin/students/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(studentMessage(err));
      else setError('Could not create student.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Students</h1>
      <p className="muted">Student registry (ACF-002). Create and edit names, codes, and status.</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Add student</h2>
        <div className="field">
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            required
            maxLength={200}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="studentCode">Student code (optional)</label>
          <input
            id="studentCode"
            value={studentCode}
            onChange={(e) => setStudentCode(e.target.value)}
            pattern="[A-Za-z0-9._-]{1,64}"
            title="Letters, numbers, . _ - up to 64 characters"
          />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StudentStatus)}
          >
            {STUDENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Create'}
        </button>
      </form>

      <form
        className="stack"
        style={{ marginTop: '1.5rem' }}
        onSubmit={(e) => {
          e.preventDefault();
          void load(search);
        }}
      >
        <div className="field">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or code"
          />
        </div>
        <button type="submit" className="btn btn-secondary" disabled={loading}>
          Search
        </button>
      </form>

      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <div className="banner banner-info">No students yet.</div>
      ) : null}
      <ul className="list">
        {rows.map((s) => (
          <li key={s.id}>
            <Link className="card" href={`/t/${tenantId}/admin/students/${s.id}`}>
              <strong>{s.displayName}</strong>
              <div className="muted">
                {s.studentCode ?? '—'} · {s.status}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
