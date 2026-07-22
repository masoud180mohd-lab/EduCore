'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';
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

function financeMessage(err: ApiClientError): string {
  if (err.status === 403) return 'You do not have finance access.';
  return teacherFriendlyMessage(err);
}

export default function AdminReceiptDetailPage() {
  const params = useParams<{ tenantId: string; receiptId: string }>();
  const { tenantId, receiptId } = params;
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ data: ReceiptDetail }>(`/api/v1/receipts/${receiptId}`, {
        auth,
      });
      setReceipt(res.data);
      try {
        const pay = await apiRequest<{ data: PaymentDetail }>(
          `/api/v1/payments/${res.data.paymentAttemptId}`,
          { auth },
        );
        setPayment(pay.data);
      } catch {
        setPayment(null);
      }
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(financeMessage(err));
      else setError('Could not load receipt.');
    } finally {
      setLoading(false);
    }
  }, [receiptId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/fees/receipts`}>← Receipts</Link>
      </p>
      <h1>{receipt?.receiptNumber ?? 'Receipt'}</h1>
      {loading ? <p className="muted">Loading…</p> : null}
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      {receipt !== null ? (
        <div className="card stack">
          <div>
            <strong>Status</strong> <span className="chip">{receipt.status}</span>
          </div>
          <div className="muted">Issued {new Date(receipt.issuedAt).toLocaleString()}</div>
          {payment !== null ? (
            <>
              <div>
                <strong>Amount</strong> {formatTzsMinor(payment.amountMinor)} {payment.currency}
              </div>
              <div>
                <strong>Method</strong> {payment.method}
              </div>
              <div className="muted">Payment status: {payment.status}</div>
              <p>
                <Link href={`/t/${tenantId}/admin/fees/invoices/${payment.invoiceId}`}>
                  Open invoice
                </Link>
              </p>
            </>
          ) : (
            <p className="muted">Payment attempt: {receipt.paymentAttemptId}</p>
          )}
        </div>
      ) : null}
    </AdminShell>
  );
}
