/**
 * Pure enablement rules for invoice/payment actions (ACF-012 / DBF-012).
 * UI still relies on API enforcement; these only drive control state.
 */

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void' | string;
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
 */
export function canReconcilePayment(status: PaymentStatus): boolean {
  return status !== '' && status !== 'created';
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
    default:
      return status;
  }
}
