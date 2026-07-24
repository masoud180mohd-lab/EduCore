'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { type ClassRow, academicMessage } from '@/lib/academic/types';
import { readSession } from '@/lib/auth/session';

export default function AdminClassDetailPage() {
  const params = useParams<{ tenantId: string; classId: string }>();
  const { tenantId, classId } = params;
  const [row, setRow] = useState<ClassRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const result = await apiRequest<{ data: ClassRow }>(`/api/v1/classes/${classId}`, {
          auth,
        });
        setRow(result.data);
        setError(null);
      } catch (err) {
        if (err instanceof ApiClientError) setError(academicMessage(err));
        else setError('Could not load class.');
      }
    })();
  }, [classId]);

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic/classes`}>← Classes</Link>
      </p>
      <h1>{row?.name ?? 'Class'}</h1>
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
          <div className="muted">Year id: {row.academicYearId}</div>
          <div className="muted">Term id: {row.termId ?? '—'}</div>
          <div className="muted">Code: {row.code ?? '—'}</div>
          <div className="muted">Id: {row.id}</div>
          <p className="muted">Read-only detail (no PATCH in ACF-005).</p>
          <p>
            <Link className="btn btn-secondary" href={`/t/${tenantId}/admin/academic/streams`}>
              Manage streams
            </Link>{' '}
            <Link className="btn btn-secondary" href={`/t/${tenantId}/admin/academic/enrollments`}>
              Enrollments
            </Link>
          </p>
        </div>
      ) : error === null ? (
        <p className="muted">Loading…</p>
      ) : null}
    </AdminShell>
  );
}
