import { describe, expect, it } from 'vitest';

import { FakePaymentProvider } from './fake-payment.provider.js';

const tenantId = '01900000-0000-7000-8000-0000000000aa';
const invoiceId = '01900000-0000-7000-8000-0000000000f1';

describe('FakePaymentProvider', () => {
  it('exposes the fake provider code', () => {
    const provider = new FakePaymentProvider();
    expect(provider.providerCode).toBe('fake');
  });

  it('returns a succeeded shape for round-hundred amounts', async () => {
    const provider = new FakePaymentProvider();
    const result = await provider.initiate({
      tenantId,
      invoiceId,
      amountMinor: 500000,
      currency: 'TZS',
      reference: 'ref-1',
    });
    expect(result.status).toBe('succeeded');
    expect(result.providerCode).toBe('fake');
    expect(result.providerRef).toContain('ref-1');
  });

  it('returns a pending shape for non-round amounts', async () => {
    const provider = new FakePaymentProvider();
    const result = await provider.initiate({
      tenantId,
      invoiceId,
      amountMinor: 12345,
      currency: 'TZS',
      reference: 'ref-2',
    });
    expect(result.status).toBe('pending');
  });

  it('generates unique provider refs per call', async () => {
    const provider = new FakePaymentProvider();
    const first = await provider.initiate({
      tenantId,
      invoiceId,
      amountMinor: 100,
      currency: 'TZS',
      reference: 'ref-3',
    });
    const second = await provider.initiate({
      tenantId,
      invoiceId,
      amountMinor: 100,
      currency: 'TZS',
      reference: 'ref-3',
    });
    expect(first.providerRef).not.toBe(second.providerRef);
  });
});
