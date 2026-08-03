import { describe, expect, it } from 'vitest';

import {
  loadClickPesaConfig,
  reportClickPesaConfig,
  resolvePaymentProviderName,
} from './clickpesa-config.js';

describe('reportClickPesaConfig', () => {
  it('defaults to fake when provider unset and secrets missing', () => {
    const report = reportClickPesaConfig({});
    expect(report.requestedProvider).toBe('fake');
    expect(report.secretsPresent).toBe(false);
    expect(report.effectiveProvider).toBe('fake');
    expect(report.missingSecrets).toEqual([
      'CLICKPESA_CLIENT_ID',
      'CLICKPESA_API_KEY',
      'CLICKPESA_CHECKSUM_KEY',
    ]);
    expect(report.baseUrlHost).toBe('api.clickpesa.com');
  });

  it('stays fake when clickpesa requested but secrets incomplete', () => {
    const report = reportClickPesaConfig({
      PAYMENT_PROVIDER: 'clickpesa',
      CLICKPESA_CLIENT_ID: 'c',
    });
    expect(report.requestedProvider).toBe('clickpesa');
    expect(report.effectiveProvider).toBe('fake');
    expect(report.missingSecrets).toEqual(['CLICKPESA_API_KEY', 'CLICKPESA_CHECKSUM_KEY']);
  });

  it('reports clickpesa effective when requested and secrets present', () => {
    const report = reportClickPesaConfig({
      PAYMENT_PROVIDER: 'clickpesa',
      CLICKPESA_CLIENT_ID: 'c',
      CLICKPESA_API_KEY: 'k',
      CLICKPESA_CHECKSUM_KEY: 's',
      CLICKPESA_BASE_URL: 'https://sandbox.example.test/third-parties',
    });
    expect(report.secretsPresent).toBe(true);
    expect(report.effectiveProvider).toBe('clickpesa');
    expect(report.missingSecrets).toEqual([]);
    expect(report.baseUrlHost).toBe('sandbox.example.test');
    expect(report).not.toHaveProperty('apiKey');
    expect(report).not.toHaveProperty('clientId');
    expect(report).not.toHaveProperty('checksumKey');
  });

  it('loadClickPesaConfig still returns null without full secrets', () => {
    expect(loadClickPesaConfig({ CLICKPESA_CLIENT_ID: 'c' })).toBeNull();
    expect(resolvePaymentProviderName({ PAYMENT_PROVIDER: 'CLICKPESA' })).toBe('clickpesa');
  });
});
