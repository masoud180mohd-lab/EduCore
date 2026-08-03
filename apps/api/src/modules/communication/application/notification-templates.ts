/**
 * Template placeholder allowlists + render (COMMS-002 / COMMS-003).
 */

export const TEMPLATE_ALLOWLISTS: Readonly<Record<string, ReadonlySet<string>>> = {
  fee_invoice_issued: new Set([
    'school_name',
    'student_name',
    'amount_tzs',
    'balance_tzs',
    'invoice_ref',
  ]),
  payment_received: new Set([
    'school_name',
    'student_name',
    'amount_tzs',
    'balance_tzs',
    'invoice_ref',
  ]),
  payment_momo_pending: new Set([
    'school_name',
    'student_name',
    'amount_tzs',
    'bill_pay',
    'invoice_ref',
  ]),
  attendance_absent_digest: new Set(['school_name', 'student_name', 'date']),
  comms_test_sms: new Set(['school_name']),
};

export function assertPayloadAllowlist(
  templateCode: string,
  payload: Readonly<Record<string, string>>,
): void {
  const allowed = TEMPLATE_ALLOWLISTS[templateCode];
  if (allowed === undefined) {
    throw new Error(`Unknown templateCode: ${templateCode}`);
  }
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      throw new Error(`Unknown placeholder: ${key}`);
    }
  }
}

export function renderTemplateBody(
  body: string,
  payload: Readonly<Record<string, string>>,
): string {
  return body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_full, rawKey: string) => {
    const key = rawKey.toLowerCase();
    const value = payload[key];
    return value !== undefined ? value : '';
  });
}

/** Normalize guardian phone to digits for vendor (255…). Returns null if unusable. */
export function normalizeTzMsisdn(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 9) return null;
  if (digits.startsWith('255') && digits.length >= 12) return digits.slice(0, 12);
  if (digits.startsWith('0') && digits.length >= 10) return `255${digits.slice(1, 10)}`;
  if (digits.length === 9) return `255${digits}`;
  if (digits.length >= 12) return digits.slice(0, 12);
  return null;
}

export function phoneLast4(e164Digits: string): string {
  const digits = e164Digits.replace(/\D/g, '');
  return digits.slice(-4);
}
