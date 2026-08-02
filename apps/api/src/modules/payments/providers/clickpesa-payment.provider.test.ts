import { describe, expect, it, vi } from 'vitest';

import { loadClickPesaConfig, resolvePaymentProviderName } from './clickpesa-config.js';
import { ClickPesaHttpClient, type ClickPesaHttpFetch } from './clickpesa-http.client.js';
import { ClickPesaPaymentProvider } from './clickpesa-payment.provider.js';

const config = {
  baseUrl: 'https://api.clickpesa.test/third-parties',
  clientId: 'client',
  apiKey: 'key',
  checksumKey: 'checksum',
};

describe('clickpesa-config', () => {
  it('defaults payment provider to fake', () => {
    expect(resolvePaymentProviderName({})).toBe('fake');
    expect(resolvePaymentProviderName({ PAYMENT_PROVIDER: 'clickpesa' })).toBe('clickpesa');
  });

  it('requires all ClickPesa secrets', () => {
    expect(loadClickPesaConfig({})).toBeNull();
    expect(
      loadClickPesaConfig({
        CLICKPESA_CLIENT_ID: 'c',
        CLICKPESA_API_KEY: 'k',
        CLICKPESA_CHECKSUM_KEY: 's',
      }),
    ).toEqual({
      baseUrl: 'https://api.clickpesa.com/third-parties',
      clientId: 'c',
      apiKey: 'k',
      checksumKey: 's',
    });
  });
});

describe('ClickPesaPaymentProvider', () => {
  it('is not configured without secrets', () => {
    const provider = new ClickPesaPaymentProvider(null);
    expect(provider.isConfigured()).toBe(false);
  });

  it('initiates Order BillPay and returns pending + billPayNumber', async () => {
    const fetchImpl = vi.fn<ClickPesaHttpFetch>((url, init) => {
      if (url.endsWith('/generate-token')) {
        return Promise.resolve(jsonResponse(200, { success: true, token: 'Bearer tok' }));
      }
      if (url.endsWith('/billpay/create-order-control-number')) {
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        expect(body).toMatchObject({
          billAmount: 1500,
          billPaymentMode: 'EXACT',
          billReference: 'attempt-1',
        });
        return Promise.resolve(jsonResponse(200, { billPayNumber: '55042914871931' }));
      }
      return Promise.reject(new Error(`unexpected url ${url}`));
    });
    const client = new ClickPesaHttpClient(config, fetchImpl);
    const provider = new ClickPesaPaymentProvider(config, client);

    const result = await provider.initiate({
      tenantId: 't1',
      invoiceId: 'inv-1',
      amountMinor: 150_000,
      currency: 'TZS',
      reference: 'attempt-1',
      description: 'School fees',
    });

    expect(result).toEqual({
      providerCode: 'clickpesa',
      providerRef: '55042914871931',
      status: 'pending',
      orderReference: 'attempt-1',
    });
  });

  it('rejects fractional minor amounts', async () => {
    const provider = new ClickPesaPaymentProvider(config, new ClickPesaHttpClient(config, vi.fn()));
    await expect(
      provider.initiate({
        tenantId: 't1',
        invoiceId: 'inv-1',
        amountMinor: 150,
        currency: 'TZS',
        reference: 'attempt-1',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('recovers on 409 by querying status', async () => {
    const fetchImpl = vi.fn<ClickPesaHttpFetch>((url) => {
      if (url.endsWith('/generate-token')) {
        return Promise.resolve(jsonResponse(200, { success: true, token: 'tok' }));
      }
      if (url.endsWith('/billpay/create-order-control-number')) {
        return Promise.resolve(jsonResponse(409, { message: 'Bill reference already used' }));
      }
      if (url.includes('/payments/attempt-1')) {
        return Promise.resolve(
          jsonResponse(200, [{ status: 'PENDING', orderReference: 'attempt-1' }]),
        );
      }
      return Promise.reject(new Error(`unexpected url ${url}`));
    });
    const provider = new ClickPesaPaymentProvider(
      config,
      new ClickPesaHttpClient(config, fetchImpl),
    );

    const result = await provider.initiate({
      tenantId: 't1',
      invoiceId: 'inv-1',
      amountMinor: 10000,
      currency: 'TZS',
      reference: 'attempt-1',
    });
    expect(result.status).toBe('pending');
    expect(result.orderReference).toBe('attempt-1');
    expect(result.providerRef).toBe('attempt-1');
  });

  it('maps query SUCCESS to succeeded', async () => {
    const fetchImpl = vi.fn<ClickPesaHttpFetch>((url) => {
      if (url.endsWith('/generate-token')) {
        return Promise.resolve(jsonResponse(200, { success: true, token: 'tok' }));
      }
      if (url.includes('/payments/attempt-9')) {
        return Promise.resolve(
          jsonResponse(200, [
            {
              id: 'tx-9',
              status: 'SUCCESS',
              orderReference: 'attempt-9',
              collectedAmount: 100,
            },
          ]),
        );
      }
      return Promise.reject(new Error(`unexpected url ${url}`));
    });
    const provider = new ClickPesaPaymentProvider(
      config,
      new ClickPesaHttpClient(config, fetchImpl),
    );
    const result = await provider.queryStatus('attempt-9');
    expect(result.status).toBe('succeeded');
    expect(result.amountMinor).toBe(10_000);
    expect(result.providerEventId).toBe('tx-9');
  });
});

function jsonResponse(status: number, body: unknown) {
  const text = JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(body),
  };
}
