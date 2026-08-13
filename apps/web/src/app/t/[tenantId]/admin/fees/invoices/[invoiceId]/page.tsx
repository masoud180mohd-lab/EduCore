'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { AdminPageHeader, Banner, ConfirmDialog } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import {
  adminGuardianFeesPath,
  adminGuardianPath,
  adminStudentPath,
} from '@/lib/admin/admin-paths';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import { resolveGuardianNames } from '@/lib/admin/resolve-related-names';
import { canFinanceManage, canFinanceReconcile, visibleAdminNavIds } from '@/lib/auth/admin-access';
import type { MeLike } from '@/lib/auth/home-preference';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import {
  billPayDisplay,
  canIssueInvoice,
  canRecordPayment,
  canReconcilePayment,
  canReversePayment,
  canSyncProviderPayment,
  canVoidInvoice,
  invoiceStatusLabel,
  paymentMethodLabel,
  paymentStatusLabel,
  reconcileOutcomeLabel,
  syncProviderDetailLabel,
} from '@/lib/finance/invoice-actions';
import { formatTzsMinor, parseMajorToMinor } from '@/lib/finance/money';

type ConfirmState =
  { readonly kind: 'void' } | { readonly kind: 'reverse'; readonly paymentId: string } | null;

type InvoiceLine = {
  readonly id: string;
  readonly description: string;
  readonly amountMinor: number;
};

type InvoiceDetail = {
  readonly id: string;
  readonly studentId: string;
  readonly academicYearId: string;
  readonly feeStructureId: string | null;
  readonly status: string;
  readonly currency: string;
  readonly totalMinor: number;
  readonly balanceMinor: number;
  readonly issuedAt: string | null;
  readonly lines: ReadonlyArray<InvoiceLine>;
};

type PaymentRow = {
  readonly id: string;
  readonly invoiceId: string;
  readonly method: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: string;
  readonly receiptId: string | null;
  readonly providerCode?: string | null;
  readonly providerRef?: string | null;
  readonly billPayNumber?: string | null;
};

type ReconciliationRow = {
  readonly id: string;
  readonly paymentAttemptId: string;
  readonly outcome: string;
  readonly attemptAmountMinor: number;
  readonly attemptStatus: string;
  readonly eventAmountMinor: number | null;
  readonly eventOutcome: string | null;
  readonly createdAt: string;
};

type SyncProviderResult = {
  readonly paymentAttemptId: string;
  readonly providerStatus: string;
  readonly completed: boolean;
  readonly detail: string;
};

const OFFICE_METHODS = ['cash', 'bank', 'cheque', 'other'] as const;

const FAKE_PROVIDER_BANNER =
  'Collect fees at the office (cash, bank, or cheque). Mobile money waits until a ClickPesa account exists (PAY-007).';

type StudentGuardianLink = {
  readonly id: string;
  readonly guardianId: string;
  readonly studentId: string;
  readonly relationshipType: string;
  readonly isPrimary: boolean;
  readonly status: string;
};

type MeEnvelope = { readonly data: MeLike };

function isProviderNotConfigured(err: ApiClientError): boolean {
  return err.status === 501 || err.code === 'NOT_IMPLEMENTED';
}

export default function AdminInvoiceDetailPage() {
  const params = useParams<{ tenantId: string; invoiceId: string }>();
  const { tenantId, invoiceId } = params;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [momoConfigured, setMomoConfigured] = useState(true);

  const [payMethod, setPayMethod] = useState<(typeof OFFICE_METHODS)[number]>('cash');
  const [payAmountMajor, setPayAmountMajor] = useState('');
  const [momoAmountMajor, setMomoAmountMajor] = useState('');

  const [canManageFinance, setCanManageFinance] = useState(false);
  const [canReconcileFinance, setCanReconcileFinance] = useState(false);

  const [showGuardians, setShowGuardians] = useState(false);
  const [showGuardianFees, setShowGuardianFees] = useState(false);
  const [guardianLinks, setGuardianLinks] = useState<StudentGuardianLink[]>([]);
  const [guardianNames, setGuardianNames] = useState<Record<string, string>>({});
  const [guardianLoading, setGuardianLoading] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);

  const loadGuardians = useCallback(async (forStudentId: string, me: MeLike) => {
    const auth = readSession();
    if (auth === null) return;
    setGuardianLoading(true);
    try {
      const navIds = visibleAdminNavIds(me);
      const canGuardians = navIds.has('guardians');
      const canFees = navIds.has('fees');
      setShowGuardians(canGuardians);
      setShowGuardianFees(canGuardians && canFees);
      if (!canGuardians) {
        setGuardianLinks([]);
        return;
      }
      const result = await apiRequest<{ data: StudentGuardianLink[] }>(
        `/api/v1/students/${forStudentId}/guardians`,
        { auth },
      );
      const active = (result.data ?? []).filter((link) => link.status === 'active');
      setGuardianLinks(active);
      const names = await resolveGuardianNames(
        auth,
        active.map((link) => link.guardianId),
      );
      setGuardianNames(names);
      setGuardianError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setGuardianError(adminFriendlyMessage(err, 'guardians'));
      else setGuardianError('Could not load guardian links.');
      setGuardianLinks([]);
    } finally {
      setGuardianLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setLoading(true);
    try {
      const [invRes, payRes, me] = await Promise.all([
        apiRequest<{ data: InvoiceDetail }>(`/api/v1/invoices/${invoiceId}`, { auth }),
        apiRequest<{ data: PaymentRow[] }>(`/api/v1/invoices/${invoiceId}/payments`, { auth }),
        apiRequest<MeEnvelope>('/api/v1/auth/me', { auth }),
      ]);
      setInvoice(invRes.data);
      setPayments(payRes.data ?? []);
      setCanManageFinance(canFinanceManage(me.data));
      setCanReconcileFinance(canFinanceReconcile(me.data));
      try {
        const st = await apiRequest<{ data: { displayName: string } }>(
          `/api/v1/students/${invRes.data.studentId}`,
          { auth },
        );
        setStudentName(st.data.displayName);
      } catch {
        setStudentName(invRes.data.studentId);
      }
      void loadGuardians(invRes.data.studentId, me.data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not load invoice.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId, loadGuardians]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onIssue() {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `invoice.issue:${invoiceId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/invoices/${invoiceId}/issue`, {
        method: 'POST',
        auth,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setInfo('Invoice issued. Revenue recognized on issue.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not issue invoice.');
    } finally {
      setBusy(false);
    }
  }

  async function runVoid() {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `invoice.void:${invoiceId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/invoices/${invoiceId}/void`, {
        method: 'POST',
        auth,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setConfirm(null);
      setInfo('Invoice voided.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not void invoice.');
    } finally {
      setBusy(false);
    }
  }

  async function onPay(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || invoice === null) return;

    const amountMinor = parseMajorToMinor(payAmountMajor);
    if (amountMinor === null) {
      setError('Enter a valid payment amount in TZS (up to 2 decimals).');
      return;
    }
    if (amountMinor > invoice.balanceMinor) {
      setError(
        `Amount exceeds balance (${formatTzsMinor(invoice.balanceMinor)}). Reduce the amount.`,
      );
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `payment.create:${invoiceId}:${amountMinor}:${payMethod}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const created = await apiRequest<{ data: PaymentRow }>('/api/v1/payments', {
        method: 'POST',
        auth,
        body: {
          invoiceId,
          method: payMethod,
          amountMinor,
          currency: 'TZS',
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setPayAmountMajor('');
      const receiptId = created.data.receiptId;
      setInfo(
        receiptId !== null && receiptId !== undefined
          ? `Payment recorded. Receipt available.`
          : 'Payment recorded.',
      );
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not record payment.');
    } finally {
      setBusy(false);
    }
  }

  async function onRequestMobileMoney(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || invoice === null) return;

    const amountMinor = parseMajorToMinor(momoAmountMajor);
    if (amountMinor === null) {
      setError('Enter a valid mobile money amount in TZS (up to 2 decimals).');
      return;
    }
    if (amountMinor > invoice.balanceMinor) {
      setError(
        `Amount exceeds balance (${formatTzsMinor(invoice.balanceMinor)}). Reduce the amount.`,
      );
      return;
    }
    if (amountMinor % 100 !== 0) {
      setError('Mobile money amounts must map to whole TZS (divisible by 100 minor units).');
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `payment.mobile-money:${invoiceId}:${amountMinor}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const created = await apiRequest<{ data: PaymentRow }>('/api/v1/payments/mobile-money', {
        method: 'POST',
        auth,
        body: {
          invoiceId,
          amountMinor,
          currency: 'TZS',
        },
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setMomoConfigured(true);
      setMomoAmountMajor('');
      const billPay = billPayDisplay(created.data);
      setInfo(
        billPay !== null
          ? `Mobile money pending. BillPay number: ${billPay}. Ask parent to pay; webhook or Refresh updates status.`
          : 'Mobile money pending. Ask parent to pay; webhook or Refresh updates status.',
      );
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (isProviderNotConfigured(err)) {
          setMomoConfigured(false);
          setError(FAKE_PROVIDER_BANNER);
        } else {
          setError(adminFriendlyMessage(err, 'finance'));
        }
      } else setError('Could not request mobile money.');
    } finally {
      setBusy(false);
    }
  }

  async function runReverse(paymentId: string) {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `payment.reverse:${paymentId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      await apiRequest(`/api/v1/payments/${paymentId}/reverse`, {
        method: 'POST',
        auth,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setConfirm(null);
      setInfo('Payment reversed.');
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'finance'));
      else setError('Could not reverse payment.');
    } finally {
      setBusy(false);
    }
  }

  async function onReconcile(paymentId: string) {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `payment.reconcile:${paymentId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const result = await apiRequest<{ data: ReconciliationRow }>(
        `/api/v1/payments/${paymentId}/reconcile`,
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
      if (err instanceof ApiClientError)
        setError(adminFriendlyMessage(err, 'finance', { action: 'reconcile' }));
      else setError('Could not reconcile payment.');
    } finally {
      setBusy(false);
    }
  }

  async function onSyncProvider(paymentId: string) {
    const auth = readSession();
    if (auth === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const actionKey = `payment.sync-provider:${paymentId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const result = await apiRequest<{ data: SyncProviderResult }>(
        `/api/v1/payments/${paymentId}/sync-provider`,
        {
          method: 'POST',
          auth,
          idempotencyKey: idem,
        },
      );
      clearIdempotencyKey(actionKey);
      setMomoConfigured(true);
      const row = result.data;
      setInfo(
        `Refresh from provider: ${paymentStatusLabel(row.providerStatus)} — ${syncProviderDetailLabel(row.detail)}${
          row.completed ? ' (ledger updated).' : '.'
        }`,
      );
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (isProviderNotConfigured(err)) {
          setMomoConfigured(false);
          setError(FAKE_PROVIDER_BANNER);
        } else {
          setError(adminFriendlyMessage(err, 'finance', { action: 'reconcile' }));
        }
      } else setError('Could not refresh payment from provider.');
    } finally {
      setBusy(false);
    }
  }

  const issueOk = invoice !== null && canIssueInvoice(invoice.status);
  const voidOk =
    invoice !== null && canVoidInvoice(invoice.status, invoice.balanceMinor, invoice.totalMinor);
  const payOk =
    invoice !== null && canRecordPayment(invoice.status, invoice.balanceMinor) && canManageFinance;
  const momoOk = payOk && momoConfigured;

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/fees/invoices`}>← Invoices</Link>
      </p>
      <AdminPageHeader title="Invoice" />
      {loading ? <p className="muted">Loading…</p> : null}
      {error !== null ? <Banner tone="error">{error}</Banner> : null}
      {info !== null ? <Banner tone="info">{info}</Banner> : null}
      {!momoConfigured ? <Banner tone="warn">{FAKE_PROVIDER_BANNER}</Banner> : null}

      {invoice !== null ? (
        <>
          <p className="muted">
            <span className="chip">{invoiceStatusLabel(invoice.status)}</span>
            {' · '}
            <Link href={adminStudentPath(tenantId, invoice.studentId)}>
              {studentName ?? invoice.studentId}
            </Link>
            {' · '}
            {invoice.currency}
          </p>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div>
              <strong>Total</strong> {formatTzsMinor(invoice.totalMinor)}
            </div>
            <div>
              <strong>Balance</strong> {formatTzsMinor(invoice.balanceMinor)}
              <span className="muted"> (derived — not editable)</span>
            </div>
            {invoice.issuedAt !== null ? (
              <div className="muted">Issued {new Date(invoice.issuedAt).toLocaleString()}</div>
            ) : null}
          </div>

          {showGuardians ? (
            <section
              className="card stack related-records-section"
              style={{ marginBottom: '1rem' }}
            >
              <h2 className="section-title" style={{ margin: 0 }}>
                Linked guardians
              </h2>
              {guardianLoading ? <p className="muted">Loading…</p> : null}
              {guardianError !== null ? <Banner tone="error">{guardianError}</Banner> : null}
              {!guardianLoading && guardianError === null && guardianLinks.length === 0 ? (
                <Banner tone="info">No active guardian links for this student.</Banner>
              ) : null}
              {!guardianLoading && guardianError === null && guardianLinks.length > 0 ? (
                <ul className="list">
                  {guardianLinks.map((link) => (
                    <li key={link.id} className="card">
                      <Link href={adminGuardianPath(tenantId, link.guardianId)}>
                        <strong>{guardianNames[link.guardianId] ?? link.guardianId}</strong>
                      </Link>
                      <div className="muted">
                        {link.relationshipType}
                        {link.isPrimary ? ' · primary' : ''}
                        {showGuardianFees ? (
                          <>
                            {' · '}
                            <Link href={adminGuardianFeesPath(tenantId, link.guardianId)}>
                              Guardian fees
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          <div className="actions" style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !issueOk}
              onClick={() => void onIssue()}
            >
              Issue
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy || !voidOk}
              onClick={() => setConfirm({ kind: 'void' })}
            >
              Void
            </button>
          </div>

          <h2 style={{ fontSize: '1.1rem' }}>Lines</h2>
          <ul className="list">
            {invoice.lines.map((line) => (
              <li key={line.id} className="card">
                <strong>{line.description}</strong>
                <div className="muted">{formatTzsMinor(line.amountMinor)}</div>
              </li>
            ))}
          </ul>

          {payOk ? (
            <form className="stack card" onSubmit={(e) => void onPay(e)}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Record office payment</h2>
              <p className="muted">
                Cash / bank / cheque / other. Mobile money uses the form below.
              </p>
              <div className="field">
                <label htmlFor="pay-method">Method</label>
                <select
                  id="pay-method"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as (typeof OFFICE_METHODS)[number])}
                >
                  {OFFICE_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="pay-amount">Amount (TZS major, ≤ balance)</label>
                <input
                  id="pay-amount"
                  required
                  inputMode="decimal"
                  placeholder={String(invoice.balanceMinor / 100)}
                  value={payAmountMajor}
                  onChange={(e) => setPayAmountMajor(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Saving…' : 'Record payment'}
              </button>
            </form>
          ) : null}

          {canManageFinance && canRecordPayment(invoice.status, invoice.balanceMinor) && momoConfigured ? (
            <form
              className="stack card"
              style={{ marginTop: '1rem' }}
              onSubmit={(e) => void onRequestMobileMoney(e)}
            >
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Request mobile money</h2>
              <p className="muted">
                Creates a pending BillPay attempt (ClickPesa). Ask parent to pay the number; webhook
                or Refresh updates status.
              </p>
              <div className="field">
                <label htmlFor="momo-amount">Amount (TZS major, ≤ balance)</label>
                <input
                  id="momo-amount"
                  required
                  inputMode="decimal"
                  placeholder={String(invoice.balanceMinor / 100)}
                  value={momoAmountMajor}
                  onChange={(e) => setMomoAmountMajor(e.target.value)}
                  disabled={!momoOk || busy}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy || !momoOk}>
                {busy ? 'Requesting…' : 'Request mobile money'}
              </button>
            </form>
          ) : null}

          <h2 style={{ fontSize: '1.1rem' }}>Payments</h2>
          {payments.length === 0 ? <Banner tone="info">No payments yet.</Banner> : null}
          <ul className="list">
            {payments.map((p) => {
              const billPay = billPayDisplay(p);
              const showSync = canSyncProviderPayment(p.status, p.method) && canReconcileFinance;
              return (
                <li key={p.id} className="card">
                  <strong>
                    {formatTzsMinor(p.amountMinor)} · {paymentMethodLabel(p.method)}
                  </strong>
                  <div className="muted">
                    <span className="chip">{paymentStatusLabel(p.status)}</span>
                    {p.receiptId !== null && p.receiptId !== undefined ? (
                      <>
                        {' · '}
                        <Link href={`/t/${tenantId}/admin/fees/receipts/${p.receiptId}`}>
                          Receipt
                        </Link>
                      </>
                    ) : null}
                  </div>
                  {billPay !== null && p.status === 'pending' ? (
                    <div>
                      <div className="muted" style={{ marginTop: '0.5rem' }}>
                        BillPay number — ask parent to pay; webhook or Refresh updates status.
                      </div>
                      <span className="billpay-number">{billPay}</span>
                    </div>
                  ) : null}
                  {canReversePayment(p.status) ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => setConfirm({ kind: 'reverse', paymentId: p.id })}
                      style={{ marginTop: '0.5rem', marginRight: '0.5rem' }}
                    >
                      Reverse
                    </button>
                  ) : null}
                  {showSync ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => void onSyncProvider(p.id)}
                      style={{ marginTop: '0.5rem', marginRight: '0.5rem' }}
                      title="Query ClickPesa and update pending payment. May complete ledger."
                    >
                      Refresh from provider
                    </button>
                  ) : null}
                  {canReconcilePayment(p.status) && canReconcileFinance ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => void onReconcile(p.id)}
                      style={{ marginTop: '0.5rem' }}
                      title="Compare payment to last gateway event. Does not change ledger or balances."
                    >
                      Reconcile
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'reverse' ? 'Reverse payment?' : 'Void invoice?'}
        body={
          confirm?.kind === 'reverse'
            ? 'Reverse this succeeded payment? Allocations and receipt will reverse.'
            : 'Void this unpaid issued invoice? This cannot be undone.'
        }
        confirmLabel={confirm?.kind === 'reverse' ? 'Reverse' : 'Void'}
        danger
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirm(null);
        }}
        onConfirm={() => {
          if (confirm?.kind === 'reverse') void runReverse(confirm.paymentId);
          else if (confirm?.kind === 'void') void runVoid();
        }}
      />
    </AdminShell>
  );
}
