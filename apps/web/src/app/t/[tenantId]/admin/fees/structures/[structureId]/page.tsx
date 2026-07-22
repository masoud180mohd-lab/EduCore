'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';
import { formatTzsMinor } from '@/lib/finance/money';

type FeeStructureItem = {
  readonly id: string;
  readonly name: string;
  readonly amountMinor: number;
  readonly sortOrder: number;
};

type FeeStructureDetail = {
  readonly id: string;
  readonly name: string;
  readonly academicYearId: string;
  readonly status: string;
  readonly currency: string;
  readonly items: ReadonlyArray<FeeStructureItem>;
};

function financeMessage(err: ApiClientError): string {
  if (err.status === 403) return 'You do not have finance access.';
  return teacherFriendlyMessage(err);
}

export default function AdminFeeStructureDetailPage() {
  const params = useParams<{ tenantId: string; structureId: string }>();
  const { tenantId, structureId } = params;
  const [row, setRow] = useState<FeeStructureDetail | null>(null);
  const [yearName, setYearName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ data: FeeStructureDetail }>(
        `/api/v1/fee-structures/${structureId}`,
        { auth },
      );
      setRow(res.data);
      try {
        const year = await apiRequest<{ data: { name: string } }>(
          `/api/v1/academic-years/${res.data.academicYearId}`,
          { auth },
        );
        setYearName(year.data.name);
      } catch {
        setYearName(res.data.academicYearId);
      }
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(financeMessage(err));
      else setError('Could not load fee structure.');
    } finally {
      setLoading(false);
    }
  }, [structureId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/fees/structures`}>← Fee structures</Link>
      </p>
      <h1>{row?.name ?? 'Fee structure'}</h1>
      {loading ? <p className="muted">Loading…</p> : null}
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      {row !== null ? (
        <>
          <p className="muted">
            <span className="chip">{row.status}</span>
            {' · '}
            {yearName ?? row.academicYearId}
            {' · '}
            {row.currency}
          </p>
          <h2 style={{ fontSize: '1.1rem' }}>Items</h2>
          {row.items.length === 0 ? (
            <div className="banner banner-info">No items on this structure.</div>
          ) : null}
          <ul className="list">
            {row.items.map((item) => (
              <li key={item.id} className="card">
                <strong>{item.name}</strong>
                <div className="muted">{formatTzsMinor(item.amountMinor)}</div>
              </li>
            ))}
          </ul>
          <p className="muted">
            Total (items): {formatTzsMinor(row.items.reduce((sum, i) => sum + i.amountMinor, 0))}
          </p>
        </>
      ) : null}
    </AdminShell>
  );
}
