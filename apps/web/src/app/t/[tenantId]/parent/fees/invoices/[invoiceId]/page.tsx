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
import { invoiceStatusLabel, paymentStatusLabel } from '@/lib/finance/invoice-actions';
import { formatTzsMinor } from '@/lib/finance/money';

type InvoiceLine = {
  readonly id: string;
  readonly description: string;
  readonly amountMinor: number;
};

type InvoiceDetail = {
  readonly id: string;
  readonly studentId: string;
  readonly status: string;
  readonly currency: string;
  readonly totalMinor: number;
  readonly balanceMinor: number;
  readonly lines: ReadonlyArray<InvoiceLine>;
};

type PaymentRow = {
  readonly id: string;
  readonly method: string;
  readonly amountMinor: number;
  readonly status: string;
  readonly receiptId: string | null;
};

function accessMessage(err: ApiClientError, noAccess: string): string {
  if (err.status === 403) {
    return noAccess;
  }
  return teacherFriendlyMessage(err);
}

export default function ParentInvoiceDetailPage() {
  const params = useParams<{ tenantId: string; invoiceId: string }>();
  const { tenantId, invoiceId } = params;
  const { t } = useAppPreferences();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const invRes = await apiRequest<{ data: InvoiceDetail }>(
        `/api/v1/me/fees/invoices/${invoiceId}`,
        { auth },
      );
      setInvoice(invRes.data);
      try {
        const payRes = await apiRequest<{ data: PaymentRow[] }>(
          `/api/v1/me/fees/invoices/${invoiceId}/payments`,
          { auth },
        );
        setPayments(payRes.data ?? []);
      } catch {
        setPayments([]);
      }
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(accessMessage(err, t('parent.noAccess')));
      else setError('Could not load invoice.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ParentShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        <div>
          {invoice !== null ? (
            <Link
              className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              href={`/t/${tenantId}/parent/fees/students/${invoice.studentId}`}
            >
              ← {t('fees.invoicesTitle')}
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

        <AdminPageHeader title={t('parent.readOnlyInvoice')} />
        <Banner tone="info">{t('parent.officePay')}</Banner>
        {error !== null ? <Banner tone="error">{error}</Banner> : null}
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}

        {!loading && invoice !== null ? (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-lg">{t('parent.readOnlyInvoice')}</CardTitle>
                  <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                    {invoiceStatusLabel(invoice.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('fees.total')}
                  </span>
                  <span className="text-2xl font-bold tabular-nums">
                    {formatTzsMinor(invoice.totalMinor)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t('fees.balance')}
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {formatTzsMinor(invoice.balanceMinor)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <h2 className="text-base font-semibold">{t('invoice.lines')}</h2>
              <div className="flex flex-col gap-2">
                {invoice.lines.map((line) => (
                  <Card key={line.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <span className="font-medium text-sm">{line.description}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatTzsMinor(line.amountMinor)}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-base font-semibold">{t('invoice.payments')}</h2>
              {payments.length === 0 ? (
                <Banner tone="info">No payments recorded yet.</Banner>
              ) : (
                <div className="flex flex-col gap-2">
                  {payments.map((p) => (
                    <Card key={p.id}>
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">
                              {formatTzsMinor(p.amountMinor)}
                            </span>
                            <span className="text-xs text-muted-foreground">· {p.method}</span>
                            <Badge variant="secondary">{paymentStatusLabel(p.status)}</Badge>
                          </div>
                        </div>
                        {p.receiptId !== null ? (
                          <Link
                            className="text-xs font-medium text-primary hover:underline"
                            href={`/t/${tenantId}/parent/fees/receipts/${p.receiptId}`}
                          >
                            {t('receipt.title')} →
                          </Link>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </ParentShell>
  );
}

