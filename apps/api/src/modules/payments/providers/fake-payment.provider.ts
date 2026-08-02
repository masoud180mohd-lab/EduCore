/**
 * Fake payment provider (IMP-009 Wave G / PAY-PROVIDER-001 / ADR-011).
 * Default CI/local provider. Deterministic-by-amount so tests can exercise
 * both outcomes without mocks:
 *  - amountMinor divisible by 100 -> succeeded immediately
 *  - otherwise                    -> pending (awaiting a later Fake webhook)
 */
import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type {
  PaymentProviderInitiateInput,
  PaymentProviderPort,
  PaymentProviderResult,
} from './payment-provider.port.js';

export const FAKE_PROVIDER_CODE = 'fake';

@Injectable()
export class FakePaymentProvider implements PaymentProviderPort {
  readonly providerCode = FAKE_PROVIDER_CODE;

  initiate(input: PaymentProviderInitiateInput): Promise<PaymentProviderResult> {
    const providerRef = `fake_${input.reference}_${randomUUID()}`;
    const status = input.amountMinor % 100 === 0 ? 'succeeded' : 'pending';
    return Promise.resolve({
      providerCode: this.providerCode,
      providerRef,
      status,
      orderReference: input.reference,
    });
  }

  queryStatus(orderReference: string): Promise<PaymentProviderResult> {
    return Promise.resolve({
      providerCode: this.providerCode,
      providerRef: `fake_query_${orderReference}`,
      status: 'pending',
      orderReference,
    });
  }
}
