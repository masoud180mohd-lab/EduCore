/**
 * Pure enablement rules for invoice/payment actions (ACF-012 / DBF-012).
 * UI still relies on API enforcement; these only drive control state.
 */

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void' | string;

/** Filter values for GET /invoices?status=. */
export const INVOICE_LIST_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'void'] as const;

export type InvoiceListStatus = (typeof INVOICE_LIST_STATUSES)[number];
export type PaymentStatus =
  | 'created'
  | 'initiated'
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'expired'
  | 'reversed'
  | 'disputed'
  | string;

export function canIssueInvoice(status: InvoiceStatus): boolean {
  return status === 'draft';
}

/** Void only issued invoices with no active payments (balance equals total). */
export function canVoidInvoice(
  status: InvoiceStatus,
  balanceMinor: number,
  totalMinor: number,
): boolean {
  return status === 'issued' && balanceMinor === totalMinor && balanceMinor >= 0;
}

export function canRecordPayment(status: InvoiceStatus, balanceMinor: number): boolean {
  return (status === 'issued' || status === 'partially_paid') && balanceMinor > 0;
}

export function canReversePayment(status: PaymentStatus): boolean {
  return status === 'succeeded';
}

/**
 * Reconcile compares attempt vs last gateway event (ACF-012).
 * Allowed for any known payment; outcome is display-only (no ledger mutation).
 * Not the same as Refresh from provider (sync-provider).
 */
export function canReconcilePayment(status: PaymentStatus): boolean {
  return status !== '' && status !== 'created';
}

/**
 * PAY-006: Refresh from provider (ClickPesa query sync) — pending mobile_money only.
 * UX gate; API still enforces finance.reconcile + provider config.
 */
export function canSyncProviderPayment(status: PaymentStatus, method: string): boolean {
  return status === 'pending' && method === 'mobile_money';
}

export type ReconcileOutcome =
  'matched' | 'amount_mismatch' | 'missing_event' | 'status_mismatch' | string;

export function reconcileOutcomeLabel(outcome: ReconcileOutcome): string {
  switch (outcome) {
    case 'matched':
      return 'Matched';
    case 'amount_mismatch':
      return 'Amount mismatch';
    case 'missing_event':
      return 'No gateway event';
    case 'status_mismatch':
      return 'Status mismatch';
    default:
      return outcome;
  }
}

export function invoiceStatusLabel(status: InvoiceStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'issued':
      return 'Issued';
    case 'partially_paid':
      return 'Partially paid';
    case 'paid':
      return 'Paid';
    case 'void':
      return 'Void';
    default:
      return status;
  }
}

export function paymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'succeeded':
      return 'Succeeded';
    case 'reversed':
      return 'Reversed';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    case 'initiated':
      return 'Initiated';
    case 'expired':
      return 'Expired';
    default:
      return status;
  }
}

export function paymentMethodLabel(method: string): string {
  switch (method) {
    case 'mobile_money':
      return 'Mobile money';
    case 'cash':
      return 'Cash';
    case 'bank':
      return 'Bank';
    case 'cheque':
      return 'Cheque';
    case 'other':
      return 'Other';
    default:
      return method;
  }
}

/** Humanize sync-provider `detail` for bursar banner (PAY-005/006). */
export function syncProviderDetailLabel(detail: string): string {
  switch (detail) {
    case 'still_pending':
      return 'Still pending at provider';
    case 'not_pending':
      return 'Already settled (not pending)';
    case 'missing_amount':
      return 'Provider succeeded but amount missing';
    case 'completed':
      return 'Completed';
    case 'amount_mismatch':
      return 'Amount mismatch';
    case 'failed':
      return 'Marked failed';
    case 'duplicate':
      return 'Already ingested (no double-post)';
    default:
      return detail;
  }
}

/** BillPay / control number from allowlist fields (never invent). */
export function billPayDisplay(payment: {
  readonly method: string;
  readonly providerRef?: string | null;
  readonly billPayNumber?: string | null;
}): string | null {
  if (payment.method !== 'mobile_money') return null;
  const fromCreate = payment.billPayNumber?.trim();
  if (fromCreate !== undefined && fromCreate !== '') return fromCreate;
  const fromRef = payment.providerRef?.trim();
  if (fromRef !== undefined && fromRef !== '') return fromRef;
  return null;
}
