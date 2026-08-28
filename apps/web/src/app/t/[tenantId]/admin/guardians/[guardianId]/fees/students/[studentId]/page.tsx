'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { readSession } from '@/lib/auth/session';
import {
  activeLinkedStudentIds,
  isStudentInAllowlist,
  type GuardianStudentLink,
} from '@/lib/finance/guardian-fees-access';
import { invoiceStatusLabel } from '@/lib/finance/invoice-actions';
import { formatTzsMinor } from '@/lib/finance/money';

type InvoiceRow = {
  readonly id: string;
  readonly studentId: string;
  readonly status: string;
  readonly totalMinor: number;
  readonly balanceMinor: number;
};

export default function GuardianStudentInvoicesPage() {
  const params = useParams<{
    tenantId: string;
    guardianId: string;
    studentId: string;
  }>();
  const { tenantId, guardianId, studentId } = params;
  const { t } = useAppPreferences();

  const [studentName, setStudentName] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [forbiddenStudent, setForbiddenStudent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const base = `/t/${tenantId}/admin/guardians/${guardianId}`;

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    setForbiddenStudent(false);
    try {
      const linksRes = await apiRequest<{ data: GuardianStudentLink[] }>(
        `/api/v1/guardians/${guardianId}/links`,
        { auth },
      );
      const allowlist = activeLinkedStudentIds(linksRes.data ?? []);
      if (!isStudentInAllowlist(studentId, allowlist)) {
        setForbiddenStudent(true);
        setInvoices([]);
        setError(null);
        return;
      }

      const [stRes, invRes] = await Promise.all([
        apiRequest<{ data: { displayName: string } }>(`/api/v1/students/${studentId}`, {
          auth,
        }).catch(() => null),
        apiRequest<{ data: InvoiceRow[] }>(
          `/api/v1/invoices?studentId=${encodeURIComponent(studentId)}&limit=50`,
          { auth },
        ),
      ]);
      setStudentName(stRes?.data.displayName ?? studentId);
      setInvoices(invRes.data ?? []);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not load invoices.');
    } finally {
      setLoading(false);
    }
  }, [guardianId, studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`${base}/fees`}>← {t('guardians.fees')}</Link>
      </p>
      <AdminPageHeader
        title={`${t('fees.invoicesTitle')} — ${studentName ?? t('students.student')}`}
      />
      <Banner tone="info">
        Pay at the school office (cash, bank, or cheque). Mobile money is not enabled (PAY-007 /
        PAY-PROVIDER-001).
      </Banner>

      {error !== null ? <Banner tone="error">{error}</Banner> : null}

      {forbiddenStudent ? (
        <Banner tone="error">This student is not actively linked to this guardian.</Banner>
      ) : null}

      {loading && !forbiddenStudent ? <p className="muted">{t('common.loading')}</p> : null}

      {!loading && !forbiddenStudent && error === null && invoices.length === 0 ? (
        <Banner tone="info">{t('students.noInvoices')}</Banner>
      ) : null}

      {!loading && !forbiddenStudent && invoices.length > 0 ? (
        <ul className="list">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link className="card" href={`${base}/fees/invoices/${inv.id}`}>
                <span className="chip">{invoiceStatusLabel(inv.status)}</span>
                <div>
                  {t('fees.balance')} {formatTzsMinor(inv.balanceMinor)} · {t('fees.total')}{' '}
                  {formatTzsMinor(inv.totalMinor)}
                </div>
                <div className="muted">{inv.id}</div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </AdminShell>
  );
}
