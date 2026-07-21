'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

type StudentRow = {
  readonly id: string;
  readonly displayName: string;
  readonly studentCode: string | null;
  readonly status: string;
};

export default function AdminStudentsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const result = await apiRequest<{ data: StudentRow[] }>('/api/v1/students?limit=50', {
          auth,
        });
        setRows(result.data ?? []);
      } catch (err) {
        if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
        else setError('Could not load students.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Students</h1>
      <p className="muted">Registry list (ACF-002). Create/edit deferred to later admin tools.</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <div className="banner banner-info">No students yet.</div>
      ) : null}
      <ul className="list">
        {rows.map((s) => (
          <li key={s.id} className="card">
            <strong>{s.displayName}</strong>
            <div className="muted">
              {s.studentCode ?? s.id} · {s.status}
            </div>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
