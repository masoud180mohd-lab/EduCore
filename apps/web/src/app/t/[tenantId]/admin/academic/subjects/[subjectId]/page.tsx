'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { type SubjectRow, academicMessage } from '@/lib/academic/types';
import { readSession } from '@/lib/auth/session';

export default function AdminSubjectDetailPage() {
  const params = useParams<{ tenantId: string; subjectId: string }>();
  const { tenantId, subjectId } = params;
  const [row, setRow] = useState<SubjectRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const result = await apiRequest<{ data: SubjectRow }>(`/api/v1/subjects/${subjectId}`, {
          auth,
        });
        setRow(result.data);
        setError(null);
      } catch (err) {
        if (err instanceof ApiClientError) setError(academicMessage(err));
        else setError('Could not load subject.');
      }
    })();
  }, [subjectId]);

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic/subjects`}>← Subjects</Link>
      </p>
      <h1>{row?.name ?? 'Subject'}</h1>
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
          <div className="muted">Code: {row.code ?? '—'}</div>
          <div className="muted">Id: {row.id}</div>
          <p className="muted">Read-only detail (no PATCH in ACF-007).</p>
        </div>
      ) : error === null ? (
        <p className="muted">Loading…</p>
      ) : null}
    </AdminShell>
  );
}
