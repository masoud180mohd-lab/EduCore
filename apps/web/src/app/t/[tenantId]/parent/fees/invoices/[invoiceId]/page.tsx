'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { ParentShell } from '@/components/ParentShell';
import { useAppPreferences } from '@/components/AppProviders';
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
      <p className="muted">
        {invoice !== null ? (
          <Link href={`/t/${tenantId}/parent/fees/students/${invoice.studentId}`}>
            ← {t('fees.invoicesTitle')}
          </Link>
        ) : (
          <Link href={`/t/${tenantId}/parent`}>← {t('fees.back')}</Link>
        )}
      </p>
      <AdminPageHeader title={t('parent.readOnlyInvoice')} />
      <Banner tone="info">{t('parent.officePay')}</Banner>
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {loading ? <p className="muted">{t('common.loading')}</p> : null}
      {!loading && invoice !== null ? (
        <>
          <div className="card stack">
            <span className="chip">{invoiceStatusLabel(invoice.status)}</span>
            <div>
              <strong>{t('fees.total')}</strong> {formatTzsMinor(invoice.totalMinor)}
            </div>
            <div>
              <strong>{t('fees.balance')}</strong> {formatTzsMinor(invoice.balanceMinor)}
            </div>
          </div>
          <h2 style={{ fontSize: '1.1rem' }}>{t('invoice.lines')}</h2>
          <ul className="list">
            {invoice.lines.map((line) => (
              <li key={line.id} className="card">
                <strong>{line.description}</strong>
                <div className="muted">{formatTzsMinor(line.amountMinor)}</div>
              </li>
            ))}
          </ul>
          <h2 style={{ fontSize: '1.1rem' }}>{t('invoice.payments')}</h2>
          {payments.length === 0 ? (
            <Banner tone="info">No payments recorded yet.</Banner>
          ) : (
            <ul className="list">
              {payments.map((p) => (
                <li key={p.id} className="card">
                  <div>
                    {formatTzsMinor(p.amountMinor)} · {p.method}
                  </div>
                  <div className="muted">
                    <span className="chip">{paymentStatusLabel(p.status)}</span>
                  </div>
                  {p.receiptId !== null ? (
                    <Link href={`/t/${tenantId}/parent/fees/receipts/${p.receiptId}`}>
                      {t('receipt.title')}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </ParentShell>
  );
}
