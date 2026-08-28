'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { ParentShell } from '@/components/ParentShell';
import { useAppPreferences } from '@/components/AppProviders';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <div className="flex flex-col gap-6">
        <div>
          {payment !== undefined ? (
            <Link
              className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              href={`/t/${tenantId}/parent/fees/invoices/${payment.invoiceId}`}
            >
              ← {t('invoice.title')}
            </Link>
          ) : (
            <Link
              className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              href={`/t/${tenantId}/parent`}
            >
              ← {t('fees.back')}
            </Link>
          )}
        </div>

        <AdminPageHeader title={t('parent.readOnlyReceipt')} />
        <Banner tone="info">{t('parent.officePay')}</Banner>
        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}

        {!loading && receipt !== null ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">
                  {t('receipt.title')} {receipt.receiptNumber}
                </CardTitle>
                <Badge variant={receipt.status === 'issued' ? 'default' : 'secondary'}>
                  {receipt.status}
                </Badge>
              </div>
              <CardDescription>
                Issued {new Date(receipt.issuedAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            {payment !== undefined ? (
              <CardContent className="grid gap-4 sm:grid-cols-2 pt-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Amount Paid
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatTzsMinor(payment.amountMinor)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Payment Method & Status
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-semibold">{payment.method}</span>
                    <Badge variant="secondary">{paymentStatusLabel(payment.status)}</Badge>
                  </div>
                </div>
              </CardContent>
            ) : null}
          </Card>
        ) : null}
      </div>
    </ParentShell>
  );
}
