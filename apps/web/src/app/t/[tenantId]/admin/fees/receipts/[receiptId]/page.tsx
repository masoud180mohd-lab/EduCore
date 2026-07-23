'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import { canReconcilePayment, reconcileOutcomeLabel } from '@/lib/finance/invoice-actions';
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

type ReconciliationRow = {
  readonly id: string;
  readonly outcome: string;
  readonly attemptAmountMinor: number;
  readonly attemptStatus: string;
  readonly eventAmountMinor: number | null;
  readonly eventOutcome: string | null;
};

function financeMessage(err: ApiClientError, action?: 'reconcile'): string {
  if (err.status === 403) {
    return action === 'reconcile'
      ? 'You do not have finance reconcile access.'
      : 'You do not have finance access.';
  }
  return teacherFriendlyMessage(err);
}

export default function AdminReceiptDetailPage() {
  const params = useParams<{ tenantId: string; receiptId: string }>();
  const { tenantId, receiptId } = params;
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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

  async function onReconcile() {
    if (payment === null) return;
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `payment.reconcile:${payment.id}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const result = await apiRequest<{ data: ReconciliationRow }>(
        `/api/v1/payments/${payment.id}/reconcile`,
        {
          method: 'POST',
          auth,
          idempotencyKey: idem,
        },
      );
      clearIdempotencyKey(actionKey);
      const row = result.data;
      const eventBit =
        row.eventAmountMinor !== null
          ? ` Event ${formatTzsMinor(row.eventAmountMinor)}${
              row.eventOutcome !== null ? ` (${row.eventOutcome})` : ''
            }.`
          : '';
      setInfo(
        `Reconcile: ${reconcileOutcomeLabel(row.outcome)} — compare only (no ledger change). Attempt ${formatTzsMinor(row.attemptAmountMinor)} (${row.attemptStatus}).${eventBit}`,
      );
    } catch (err) {
      if (err instanceof ApiClientError) setError(financeMessage(err, 'reconcile'));
      else setError('Could not reconcile payment.');
    } finally {
      setBusy(false);
    }
  }

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
      {info !== null ? (
        <div className="banner banner-info" role="status">
          {info}
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
              {canReconcilePayment(payment.status) ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => void onReconcile()}
                  title="Compare payment to last gateway event. Does not change ledger or balances."
                >
                  {busy ? 'Reconciling…' : 'Reconcile payment'}
                </button>
              ) : null}
              <p className="muted" style={{ fontSize: '0.875rem' }}>
                Reconcile records a compare-only outcome (matched / mismatch / missing event). It
                does not post journals or change balances.
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
