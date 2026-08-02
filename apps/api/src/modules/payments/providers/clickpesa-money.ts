/**
 * ClickPesa ↔ EduCore money helpers (PAY-002 / PAY-003).
 * ClickPesa BillPay amounts are treated as major TZS; EduCore uses minor (×100).
 */

export const TZS_MINOR_SCALE = 100;

export function minorToClickPesaMajor(amountMinor: number): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('amountMinor must be a positive safe integer.');
  }
  if (amountMinor % TZS_MINOR_SCALE !== 0) {
    throw new Error('amountMinor must be divisible by 100 for ClickPesa MVP (whole TZS only).');
  }
  return amountMinor / TZS_MINOR_SCALE;
}

export function clickPesaMajorToMinor(collectedAmount: string | number): number {
  const major = typeof collectedAmount === 'number' ? collectedAmount : Number(collectedAmount);
  if (!Number.isFinite(major) || major < 0) {
    throw new Error('collectedAmount must be a non-negative finite number.');
  }
  const minor = Math.round(major * TZS_MINOR_SCALE);
  if (!Number.isSafeInteger(minor) || minor <= 0) {
    throw new Error('collectedAmount does not convert to a positive safe minor amount.');
  }
  return minor;
}

export type ClickPesaPaymentStatus =
  | 'SUCCESS'
  | 'SETTLED'
  | 'PROCESSING'
  | 'PENDING'
  | 'FAILED'
  | 'ON-HOLD'
  | 'REFUNDED'
  | 'REVERSED'
  | string;

/** Maps ClickPesa payment status → EduCore provider status (PAY-002). */
export function mapClickPesaStatus(
  status: ClickPesaPaymentStatus,
): 'pending' | 'succeeded' | 'failed' | 'ignored' {
  switch (status) {
    case 'PENDING':
    case 'PROCESSING':
    case 'ON-HOLD':
      return 'pending';
    case 'SUCCESS':
    case 'SETTLED':
      return 'succeeded';
    case 'FAILED':
      return 'failed';
    case 'REFUNDED':
    case 'REVERSED':
      return 'ignored';
    default:
      return 'pending';
  }
}
