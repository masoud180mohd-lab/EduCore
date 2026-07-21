'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

type UserRow = {
  readonly id: string;
  readonly email?: string;
  readonly displayName?: string | null;
  readonly status?: string;
};

export default function AdminUsersPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const result = await apiRequest<{ data: UserRow[] }>('/api/v1/users?limit=50', { auth });
        setRows(result.data ?? []);
      } catch (err) {
        if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
        else setError('Could not load users.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Users</h1>
      <p className="muted">Staff and membership directory for this school.</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <div className="banner banner-info">No users returned.</div>
      ) : null}
      <ul className="list">
        {rows.map((u) => (
          <li key={u.id} className="card">
            <strong>{u.displayName ?? u.email ?? u.id}</strong>
            <div className="muted">
              {u.email ?? u.id}
              {u.status !== undefined ? ` · ${u.status}` : ''}
            </div>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
