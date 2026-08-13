'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { ParentShell } from '@/components/ParentShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';
import { invoiceStatusLabel } from '@/lib/finance/invoice-actions';
import { formatTzsMinor } from '@/lib/finance/money';

type InvoiceRow = {
  readonly id: string;
  readonly status: string;
  readonly totalMinor: number;
  readonly balanceMinor: number;
};

function accessMessage(err: ApiClientError): string {
  if (err.status === 403) {
    return 'You do not have parent portal access.';
  }
  return teacherFriendlyMessage(err);
}

export default function ParentStudentInvoicesPage() {
  const params = useParams<{ tenantId: string; studentId: string }>();
  const { tenantId, studentId } = params;
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const invRes = await apiRequest<{ data: InvoiceRow[] }>(
        `/api/v1/me/fees/invoices?studentId=${encodeURIComponent(studentId)}&limit=50`,
        { auth },
      );
      setInvoices(invRes.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(accessMessage(err));
      else setError('Could not load invoices.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ParentShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/parent`}>← Fees</Link>
      </p>
      <AdminPageHeader title="Invoices" />
      <Banner tone="info">
        Pay at the school office. Mobile money is not enabled (PAY-PROVIDER-001).
      </Banner>
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && error === null && invoices.length === 0 ? (
        <Banner tone="info">No invoices for this student yet.</Banner>
      ) : null}
      {!loading && invoices.length > 0 ? (
        <ul className="list">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link className="card" href={`/t/${tenantId}/parent/fees/invoices/${inv.id}`}>
                <span className="chip">{invoiceStatusLabel(inv.status)}</span>
                <div>
                  Balance {formatTzsMinor(inv.balanceMinor)} · Total{' '}
                  {formatTzsMinor(inv.totalMinor)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </ParentShell>
  );
}
