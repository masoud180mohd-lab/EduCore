'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

type OrgRow = {
  readonly id: string;
  readonly name?: string;
  readonly code?: string | null;
  readonly orgType?: string;
  readonly status?: string;
};

export default function AdminOrganizationsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const result = await apiRequest<{ data: OrgRow[] }>('/api/v1/organizations?limit=50', {
          auth,
        });
        setRows(result.data ?? []);
      } catch (err) {
        if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
        else setError('Could not load organizations.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Organizations</h1>
      <p className="muted">Campuses and organizational units.</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <div className="banner banner-info">No organizations yet.</div>
      ) : null}
      <ul className="list">
        {rows.map((o) => (
          <li key={o.id} className="card">
            <strong>{o.name ?? o.id}</strong>
            <div className="muted">{[o.code, o.orgType, o.status].filter(Boolean).join(' · ')}</div>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
