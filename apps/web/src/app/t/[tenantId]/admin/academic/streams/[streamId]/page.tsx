'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { type StreamRow, academicMessage } from '@/lib/academic/types';
import { readSession } from '@/lib/auth/session';

export default function AdminStreamDetailPage() {
  const params = useParams<{ tenantId: string; streamId: string }>();
  const { tenantId, streamId } = params;
  const [row, setRow] = useState<StreamRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const result = await apiRequest<{ data: StreamRow }>(`/api/v1/streams/${streamId}`, {
          auth,
        });
        setRow(result.data);
        setError(null);
      } catch (err) {
        if (err instanceof ApiClientError) setError(academicMessage(err));
        else setError('Could not load stream.');
      }
    })();
  }, [streamId]);

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
      {row !== null ? (
        <div className="card stack">
          <div>
            <span className="chip">{row.status}</span>
          </div>
          <div className="muted">Class id: {row.classId}</div>
          <div className="muted">Code: {row.code ?? '—'}</div>
          <div className="muted">Id: {row.id}</div>
          <p className="muted">Read-only detail (no PATCH in ACF-006).</p>
        </div>
      ) : error === null ? (
        <p className="muted">Loading…</p>
      ) : null}
    </AdminShell>
  );
}
