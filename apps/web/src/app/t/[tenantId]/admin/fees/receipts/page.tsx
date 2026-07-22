'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

type ReceiptRow = {
  readonly id: string;
  readonly paymentAttemptId: string;
  readonly receiptNumber: string;
  readonly status: string;
  readonly issuedAt: string;
};

function financeMessage(err: ApiClientError): string {
  if (err.status === 403) return 'You do not have finance access.';
  return teacherFriendlyMessage(err);
}

export default function AdminReceiptsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const result = await apiRequest<{ data: ReceiptRow[] }>('/api/v1/receipts?limit=50', {
          auth,
        });
        setRows(result.data ?? []);
        setError(null);
      } catch (err) {
        if (err instanceof ApiClientError) setError(financeMessage(err));
        else setError('Could not load receipts.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/fees`}>← Fees</Link>
      </p>
      <h1>Receipts</h1>
      <p className="muted">Issued after succeeded office payments (ACF-012).</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && rows.length === 0 ? (
        <div className="banner banner-info">No receipts yet.</div>
      ) : null}
      <ul className="list">
        {rows.map((r) => (
          <li key={r.id}>
            <Link className="card" href={`/t/${tenantId}/admin/fees/receipts/${r.id}`}>
              <strong>{r.receiptNumber}</strong>
              <div className="muted">
                <span className="chip">{r.status}</span>
                {' · '}
                {new Date(r.issuedAt).toLocaleString()}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
