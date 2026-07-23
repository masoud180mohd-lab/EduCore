'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';
import {
  activeLinkedStudentIds,
  isStudentInAllowlist,
  type GuardianStudentLink,
} from '@/lib/finance/guardian-fees-access';
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
  readonly issuedAt: string | null;
  readonly lines: ReadonlyArray<InvoiceLine>;
};

type PaymentRow = {
  readonly id: string;
  readonly method: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: string;
  readonly receiptId: string | null;
};

function accessMessage(err: ApiClientError): string {
  if (err.status === 403) {
    return 'You do not have finance / guardian access.';
  }
  if (err.status === 404) {
    return 'Invoice not found.';
  }
  return teacherFriendlyMessage(err);
}

export default function GuardianFeesInvoiceDetailPage() {
  const params = useParams<{
    tenantId: string;
    guardianId: string;
    invoiceId: string;
  }>();
  const { tenantId, guardianId, invoiceId } = params;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [studentName, setStudentName] = useState<string | null>(null);
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
      const [linksRes, invRes] = await Promise.all([
        apiRequest<{ data: GuardianStudentLink[] }>(`/api/v1/guardians/${guardianId}/links`, {
          auth,
        }),
        apiRequest<{ data: InvoiceDetail }>(`/api/v1/invoices/${invoiceId}`, { auth }),
      ]);
      const allowlist = activeLinkedStudentIds(linksRes.data ?? []);
      if (!isStudentInAllowlist(invRes.data.studentId, allowlist)) {
        setIsolationBlocked(true);
        setInvoice(null);
        setPayments([]);
        setError(null);
        return;
      }

      setInvoice(invRes.data);
      let paymentsWarning: string | null = null;
      try {
        const payRes = await apiRequest<{ data: PaymentRow[] }>(
          `/api/v1/invoices/${invoiceId}/payments`,
          { auth },
        );
        setPayments(payRes.data ?? []);
      } catch (payErr) {
        setPayments([]);
        if (payErr instanceof ApiClientError && payErr.status === 403) {
          paymentsWarning = 'Payments are not visible with your access.';
        }
      }

      try {
        const st = await apiRequest<{ data: { displayName: string } }>(
          `/api/v1/students/${invRes.data.studentId}`,
          { auth },
        );
        setStudentName(st.data.displayName);
      } catch {
        setStudentName(invRes.data.studentId);
      }
      setError(paymentsWarning);
    } catch (err) {
      if (err instanceof ApiClientError) setError(accessMessage(err));
      else setError('Could not load invoice.');
    } finally {
      setLoading(false);
    }
  }, [guardianId, invoiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        {invoice !== null ? (
          <Link href={`${base}/fees/students/${invoice.studentId}`}>← Student invoices</Link>
        ) : (
          <Link href={`${base}/fees`}>← Guardian fees</Link>
        )}
      </p>
      <h1>Invoice (read-only)</h1>
      <div className="banner banner-info" role="status">
        Pay at the school office. Mobile money is not enabled (PAY-PROVIDER-001).
      </div>

      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}

      {isolationBlocked ? (
        <div className="banner banner-error" role="alert">
          This invoice belongs to a student not actively linked to this guardian.
        </div>
      ) : null}

      {loading && !isolationBlocked ? <p className="muted">Loading…</p> : null}

      {!loading && invoice !== null && !isolationBlocked ? (
        <>
          <p className="muted">
            Student: {studentName ?? invoice.studentId}
            {invoice.issuedAt !== null ? ` · Issued ${invoice.issuedAt}` : null}
          </p>
          <div className="card stack">
            <div>
              <span className="chip">{invoiceStatusLabel(invoice.status)}</span>
            </div>
            <div>
              <strong>Total</strong> {formatTzsMinor(invoice.totalMinor)}
            </div>
            <div>
              <strong>Balance</strong> {formatTzsMinor(invoice.balanceMinor)}
            </div>
            <div className="muted">
              {invoice.currency} · {invoice.id}
            </div>
          </div>

          <h2 style={{ fontSize: '1.1rem' }}>Lines</h2>
          {invoice.lines.length === 0 ? (
            <div className="banner banner-info">No line items.</div>
          ) : (
            <ul className="list">
              {invoice.lines.map((line) => (
                <li key={line.id} className="card">
                  <strong>{line.description}</strong>
                  <div className="muted">{formatTzsMinor(line.amountMinor)}</div>
                </li>
              ))}
            </ul>
          )}

          <h2 style={{ fontSize: '1.1rem' }}>Payments</h2>
          {payments.length === 0 ? (
            <div className="banner banner-info">No payments recorded yet.</div>
          ) : (
            <ul className="list">
              {payments.map((p) => (
                <li key={p.id} className="card">
                  <div>
                    {formatTzsMinor(p.amountMinor)} · {p.method}
                  </div>
                  <div className="muted">
                    <span className="chip">{paymentStatusLabel(p.status)}</span> · {p.id}
                  </div>
                  {p.receiptId !== null ? (
                    <Link href={`${base}/fees/receipts/${p.receiptId}`}>View receipt</Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </AdminShell>
  );
}
