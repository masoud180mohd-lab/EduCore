'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { ParentShell } from '@/components/ParentShell';
import { useAppPreferences } from '@/components/AppProviders';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';
import { paymentStatusLabel } from '@/lib/finance/invoice-actions';
import { formatTzsMinor } from '@/lib/finance/money';

type ReceiptPayload = {
  readonly id: string;
  readonly paymentAttemptId: string;
  readonly receiptNumber: string;
  readonly status: string;
  readonly issuedAt: string;
  readonly payment?: {
    readonly id: string;
    readonly invoiceId: string;
    readonly method: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly status: string;
  };
};

function accessMessage(err: ApiClientError, noAccess: string): string {
  if (err.status === 403) {
    return noAccess;
  }
  return teacherFriendlyMessage(err);
}

export default function ParentReceiptDetailPage() {
  const params = useParams<{ tenantId: string; receiptId: string }>();
  const { tenantId, receiptId } = params;
  const { t } = useAppPreferences();
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const receiptRes = await apiRequest<{ data: ReceiptPayload }>(
        `/api/v1/me/fees/receipts/${receiptId}`,
        { auth },
      );
      setReceipt(receiptRes.data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(accessMessage(err, t('parent.noAccess')));
      else setError('Could not load receipt.');
    } finally {
      setLoading(false);
    }
  }, [receiptId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const payment = receipt?.payment;

  return (
    <ParentShell tenantId={tenantId}>
      <p className="muted">
        {payment !== undefined ? (
          <Link href={`/t/${tenantId}/parent/fees/invoices/${payment.invoiceId}`}>← {t('invoice.title')}</Link>
        ) : (
          <Link href={`/t/${tenantId}/parent`}>← {t('fees.back')}</Link>
        )}
      </p>
      <AdminPageHeader title={t('parent.readOnlyReceipt')} />
      <Banner tone="info">{t('parent.officePay')}</Banner>
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {loading ? <p className="muted">{t('common.loading')}</p> : null}
      {!loading && receipt !== null ? (
        <div className="card stack">
          <div>
            <strong>{t('receipt.title')}</strong> {receipt.receiptNumber}
          </div>
          <div className="muted">
            {receipt.status} · Issued {receipt.issuedAt}
          </div>
          {payment !== undefined ? (
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
        </div>
      ) : null}
    </ParentShell>
  );
}
