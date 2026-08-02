/**
 * Payment provider port (IMP-009 / PAY-PROVIDER-001 / PAY-002 / PAY-003 / ADR-011).
 * Only opaque provider_code + provider_ref cross this boundary — no vendor
 * SDKs or MNO-specific enums belong in domain models.
 */

export type PaymentProviderStatus = 'pending' | 'succeeded' | 'failed';

export type PaymentProviderInitiateInput = {
  readonly tenantId: string;
  readonly invoiceId: string;
  readonly amountMinor: number;
  readonly currency: string;
  /** Caller-supplied idempotent reference (e.g. the payment attempt id). */
  readonly reference: string;
  /** Optional bill description for gateway collect UX (no extra child PII). */
  readonly description?: string;
};

export type PaymentProviderResult = {
  readonly providerCode: string;
  readonly providerRef: string;
  readonly status: PaymentProviderStatus;
  /** Order / bill reference sent to the provider (often = attempt id). */
  readonly orderReference?: string;
  /** Collected amount in EduCore minor units when known (PAY-005 query). */
  readonly amountMinor?: number;
  /** Opaque provider transaction id for gateway-event dedupe. */
  readonly providerEventId?: string;
};

export interface PaymentProviderPort {
  readonly providerCode: string;
  initiate(input: PaymentProviderInitiateInput): Promise<PaymentProviderResult>;
  /** Optional on Fake; required for ClickPesa reconcile / 409 recovery. */
  queryStatus?(orderReference: string): Promise<PaymentProviderResult>;
}

export const PAYMENT_PROVIDER_PORT = Symbol('PAYMENT_PROVIDER_PORT');
