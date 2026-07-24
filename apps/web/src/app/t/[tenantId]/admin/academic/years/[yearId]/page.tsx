'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { type AcademicYearRow, academicMessage } from '@/lib/academic/types';
import { readSession } from '@/lib/auth/session';

export default function AdminAcademicYearDetailPage() {
  const params = useParams<{ tenantId: string; yearId: string }>();
  const { tenantId, yearId } = params;
  const [row, setRow] = useState<AcademicYearRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const result = await apiRequest<{ data: AcademicYearRow }>(
          `/api/v1/academic-years/${yearId}`,
          { auth },
        );
        setRow(result.data);
        setError(null);
      } catch (err) {
        if (err instanceof ApiClientError) setError(academicMessage(err));
        else setError('Could not load academic year.');
      }
    })();
  }, [yearId]);

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic/years`}>← Years</Link>
      </p>
      <h1>{row?.name ?? 'Academic year'}</h1>
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
          <div className="muted">
            Dates: {row.startsOn ?? '—'} → {row.endsOn ?? '—'}
          </div>
          <div className="muted">Id: {row.id}</div>
          <p className="muted">
            Read-only detail. Rename or status changes need a future API (no PATCH in ACF-003).
          </p>
          <p>
            <Link className="btn btn-secondary" href={`/t/${tenantId}/admin/academic/terms`}>
              Manage terms
            </Link>
          </p>
        </div>
      ) : error === null ? (
        <p className="muted">Loading…</p>
      ) : null}
    </AdminShell>
  );
}
