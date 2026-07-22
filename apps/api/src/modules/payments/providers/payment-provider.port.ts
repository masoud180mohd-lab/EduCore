/**
 * Payment provider port (IMP-009 Wave G / PAY-PROVIDER-001).
 * Only opaque provider_code + provider_ref cross this boundary — no vendor
 * SDKs or M-Pesa/Mixx-specific enums belong in domain models (ADR-011).
 * Production webhook wiring is deferred; only the Fake implementation ships
 * until a superseding brief supplies a sandbox contract.
 */

export type PaymentProviderStatus = 'pending' | 'succeeded' | 'failed';

export type PaymentProviderInitiateInput = {
  readonly tenantId: string;
  readonly invoiceId: string;
  readonly amountMinor: number;
  readonly currency: string;
  /** Caller-supplied idempotent reference (e.g. the payment attempt id). */
  readonly reference: string;
};

export type PaymentProviderResult = {
  readonly providerCode: string;
  readonly providerRef: string;
  readonly status: PaymentProviderStatus;
};

export interface PaymentProviderPort {
  readonly providerCode: string;
  initiate(input: PaymentProviderInitiateInput): Promise<PaymentProviderResult>;
}

export const PAYMENT_PROVIDER_PORT = Symbol('PAYMENT_PROVIDER_PORT');
