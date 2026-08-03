import { describe, expect, it, vi } from 'vitest';

import {
  loadBeemConfig,
  loadBeemWebhookSecret,
  reportBeemConfig,
  resolveSmsProviderName,
} from './beem-config.js';
import { BeemHttpClient, type BeemHttpFetch } from './beem-http.client.js';
import { BeemSmsProvider, mapBeemSendResponse } from './beem-sms.provider.js';

const config = {
  baseUrl: 'https://apisms.beem.test',
  apiKey: 'api',
  secretKey: 'secret',
  sourceAddr: 'INFO',
};

describe('beem-config', () => {
  it('defaults SMS provider to fake', () => {
    expect(resolveSmsProviderName({})).toBe('fake');
    expect(resolveSmsProviderName({ SMS_PROVIDER: 'beem' })).toBe('beem');
    expect(resolveSmsProviderName({ SMS_PROVIDER: 'BEEM' })).toBe('beem');
  });

  it('requires all Beem send secrets', () => {
    expect(loadBeemConfig({})).toBeNull();
    expect(
      loadBeemConfig({
        BEEM_API_KEY: 'k',
        BEEM_SECRET_KEY: 's',
        BEEM_SOURCE_ADDR: 'INFO',
      }),
    ).toEqual({
      baseUrl: 'https://apisms.beem.africa',
      apiKey: 'k',
      secretKey: 's',
      sourceAddr: 'INFO',
    });
  });

  it('reports effective provider without leaking secrets', () => {
    const report = reportBeemConfig({
      SMS_PROVIDER: 'beem',
      BEEM_API_KEY: 'k',
      BEEM_SECRET_KEY: 's',
      BEEM_SOURCE_ADDR: 'INFO',
      BEEM_WEBHOOK_SECRET: 'wh',
    });
    expect(report.effectiveProvider).toBe('beem');
    expect(report.webhookSecretConfigured).toBe(true);
    expect(report).not.toHaveProperty('apiKey');
    expect(report).not.toHaveProperty('secretKey');
    expect(loadBeemWebhookSecret({ BEEM_WEBHOOK_SECRET: 'wh' })).toBe('wh');
  });

  it('falls back to fake when secrets incomplete', () => {
    const report = reportBeemConfig({
      SMS_PROVIDER: 'beem',
      BEEM_API_KEY: 'k',
    });
    expect(report.effectiveProvider).toBe('fake');
    expect(report.missingSecrets).toEqual(['BEEM_SECRET_KEY', 'BEEM_SOURCE_ADDR']);
  });
});

describe('mapBeemSendResponse', () => {
  it('maps successful Beem body to sent', () => {
    expect(
      mapBeemSendResponse(200, { successful: true, request_id: 67, code: 100 }, 'req'),
    ).toEqual({
      providerCode: 'beem',
      providerMessageId: '67',
      status: 'sent',
    });
  });

  it('maps error body to failed', () => {
    const result = mapBeemSendResponse(
      400,
      { successful: false, code: 111, message: 'Invalid Sender ID' },
      'req',
    );
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('111');
    expect(result.errorMessage).toBe('Invalid Sender ID');
  });
});

describe('BeemSmsProvider', () => {
  it('is not configured without secrets', () => {
    const provider = new BeemSmsProvider(null);
    expect(provider.isConfigured()).toBe(false);
  });

  it('sends via Basic auth and returns Beem request_id', async () => {
    const fetchImpl = vi.fn<BeemHttpFetch>((url, init) => {
      expect(url).toBe('https://apisms.beem.test/v1/send');
      expect(init?.method).toBe('POST');
      expect(init?.headers?.['Authorization']).toMatch(/^Basic /);
      expect(init?.headers?.['Content-Type']).toBe('application/json');
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        source_addr: 'INFO',
        encoding: 0,
        message: 'Hello Shule',
      });
      const recipients = body['recipients'] as ReadonlyArray<Record<string, string>>;
      expect(recipients[0]?.['dest_addr']).toBe('255712345678');
      return Promise.resolve(jsonResponse(200, { successful: true, request_id: 99, code: 100 }));
    });
    const client = new BeemHttpClient(config, fetchImpl);
    const provider = new BeemSmsProvider(config, client);

    const result = await provider.send({
      tenantId: 't1',
      requestId: '01900000-0000-7000-8000-0000000000c1',
      toE164: '255712345678',
      body: 'Hello Shule',
      clientRef: '01900000-0000-7000-8000-0000000000c1',
    });

    expect(result).toEqual({
      providerCode: 'beem',
      providerMessageId: '99',
      status: 'sent',
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

function jsonResponse(
  status: number,
  body: unknown,
): {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
} {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}
