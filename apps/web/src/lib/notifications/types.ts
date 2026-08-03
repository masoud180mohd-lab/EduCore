/**
 * Notifications / SMS admin types (ACF-014 / COMMS-006).
 * Mirror catalog allowlists — unknown keys rejected by API.
 */

export type NotificationLocale = 'en' | 'sw';

export const NOTIFICATION_LOCALES: ReadonlyArray<NotificationLocale> = ['en', 'sw'];

export type NotificationTemplate = {
  readonly id: string;
  readonly code: string;
  readonly channel: string;
  readonly locale: string;
  readonly version: number;
  readonly body: string;
  readonly status: string;
  readonly createdAt?: string;
};

export type NotificationRequest = {
  readonly id: string;
  readonly tenantId: string;
  readonly templateCode: string;
  readonly templateVersion: number;
  readonly locale: string;
  readonly channel: string;
  readonly recipientType: string;
  readonly recipientId: string;
  readonly payload: Readonly<Record<string, string>>;
  readonly status: string;
  readonly skipReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type NotificationDelivery = {
  readonly id: string;
  readonly tenantId: string;
  readonly requestId: string;
  readonly providerCode: string;
  readonly providerMessageId: string | null;
  readonly phoneLast4: string | null;
  readonly status: string;
  readonly segmentCount: number | null;
  readonly errorCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type NotificationUsage = {
  readonly usageDate: string;
  readonly channel: string;
  readonly sentCount: number;
  readonly segmentCount: number;
  readonly dailyCap: number | null;
  readonly bypassDailyCap: boolean;
};

export const DELIVERY_STATUS_FILTERS: ReadonlyArray<
  | {
      readonly value: '';
      readonly label: string;
    }
  | {
      readonly value: string;
      readonly label: string;
    }
> = [
  { value: '', label: 'All statuses' },
  { value: 'queued', label: 'queued' },
  { value: 'submitted', label: 'submitted' },
  { value: 'sent', label: 'sent' },
  { value: 'delivered', label: 'delivered' },
  { value: 'failed', label: 'failed' },
];

/** Catalog allowlists (SMS_TEMPLATE_CATALOG / COMMS-002). */
export const TEMPLATE_PAYLOAD_ALLOWLISTS: Readonly<Record<string, ReadonlyArray<string>>> = {
  fee_invoice_issued: ['school_name', 'student_name', 'amount_tzs', 'balance_tzs', 'invoice_ref'],
  payment_received: ['school_name', 'student_name', 'amount_tzs', 'balance_tzs', 'invoice_ref'],
  payment_momo_pending: ['school_name', 'student_name', 'amount_tzs', 'bill_pay', 'invoice_ref'],
  attendance_absent_digest: ['school_name', 'student_name', 'date'],
  comms_test_sms: ['school_name'],
};

export function payloadKeysForTemplate(templateCode: string): ReadonlyArray<string> {
  return TEMPLATE_PAYLOAD_ALLOWLISTS[templateCode] ?? [];
}

/** Shorten UUID for table display — never a phone. */
export function shortId(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 8)}…`;
}

export function formatPhoneLast4(last4: string | null): string {
  if (last4 === null || last4 === '') return '—';
  return `····${last4}`;
}

export function requestStatusLabel(status: string, skipReason: string | null): string {
  if (status === 'skipped') {
    return skipReason !== null && skipReason !== '' ? `skipped (${skipReason})` : 'skipped';
  }
  return status;
}
