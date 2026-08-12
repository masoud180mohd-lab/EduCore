'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { readSession } from '@/lib/auth/session';
import {
  activeLinkedStudentIds,
  isStudentInAllowlist,
  type GuardianStudentLink,
} from '@/lib/finance/guardian-fees-access';
import { paymentStatusLabel } from '@/lib/finance/invoice-actions';
import { formatTzsMinor } from '@/lib/finance/money';

type ReceiptDetail = {
  readonly id: string;
  readonly paymentAttemptId: string;
  readonly receiptNumber: string;
  readonly status: string;
  readonly issuedAt: string;
};

type PaymentDetail = {
  readonly id: string;
  readonly invoiceId: string;
  readonly method: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: string;
};

type InvoiceLite = {
  readonly id: string;
  readonly studentId: string;
};

export default function GuardianFeesReceiptDetailPage() {
  const params = useParams<{
    tenantId: string;
    guardianId: string;
    receiptId: string;
  }>();
  const { tenantId, guardianId, receiptId } = params;

  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [isolationBlocked, setIsolationBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const base = `/t/${tenantId}/admin/guardians/${guardianId}`;

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    setIsolationBlocked(false);
    try {
      const receiptRes = await apiRequest<{ data: ReceiptDetail }>(
        `/api/v1/receipts/${receiptId}`,
        { auth },
      );
      const payRes = await apiRequest<{ data: PaymentDetail }>(
        `/api/v1/payments/${receiptRes.data.paymentAttemptId}`,
        { auth },
      );
      const invoiceRes = await apiRequest<{ data: InvoiceLite }>(
        `/api/v1/invoices/${payRes.data.invoiceId}`,
        { auth },
      );
      const linksRes = await apiRequest<{ data: GuardianStudentLink[] }>(
        `/api/v1/guardians/${guardianId}/links`,
        { auth },
      );
      const allowlist = activeLinkedStudentIds(linksRes.data ?? []);
      if (!isStudentInAllowlist(invoiceRes.data.studentId, allowlist)) {
        setIsolationBlocked(true);
        setReceipt(null);
        setPayment(null);
        setError(null);
        return;
      }

      setReceipt(receiptRes.data);
      setPayment(payRes.data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not load receipt.');
    } finally {
      setLoading(false);
    }
  }, [guardianId, receiptId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        {payment !== null ? (
          <Link href={`${base}/fees/invoices/${payment.invoiceId}`}>← Invoice</Link>
        ) : (
          <Link href={`${base}/fees`}>← Guardian fees</Link>
        )}
      </p>
      <AdminPageHeader title="Receipt (read-only)" />
      <Banner tone="info">
        Pay at the school office. Mobile money is not enabled (PAY-PROVIDER-001).
      </Banner>

      {error !== null ? <Banner tone="error">{error}</Banner> : null}

      {isolationBlocked ? (
        <Banner tone="error">
          This receipt belongs to a student not actively linked to this guardian.
        </Banner>
      ) : null}

      {loading && !isolationBlocked ? <p className="muted">Loading…</p> : null}

      {!loading && receipt !== null && !isolationBlocked ? (
        <div className="card stack">
          <div>
            <strong>Receipt</strong> {receipt.receiptNumber}
          </div>
          <div className="muted">
            {receipt.status} · Issued {receipt.issuedAt}
          </div>
          {payment !== null ? (
            <>
              <div>
                <strong>Amount</strong> {formatTzsMinor(payment.amountMinor)} {payment.currency}
              </div>
              <div className="muted">
                {payment.method} ·{' '}
                <span className="chip">{paymentStatusLabel(payment.status)}</span>
              </div>
            </>
          ) : null}
          <div className="muted">Payment {receipt.paymentAttemptId}</div>
        </div>
      ) : null}
    </AdminShell>
  );
}
