import { describe, expect, it } from 'vitest';

import {
  exitCodeForReport,
  formatClickPesaConfigReport,
  mergePaymentEnvFromDotenv,
} from '../../scripts/check-clickpesa-config.js';
import { reportClickPesaConfig } from '../../apps/api/src/modules/payments/providers/clickpesa-config.js';

describe('PAY-OPS-001 payments:check-config', () => {
  it('merges only payment keys from dotenv text', () => {
    const merged = mergePaymentEnvFromDotenv(
      { NODE_ENV: 'development', PAYMENT_PROVIDER: 'fake' },
      [
        '# comment',
        'PAYMENT_PROVIDER=clickpesa',
        'CLICKPESA_CLIENT_ID=abc',
        'DATABASE_URL=postgresql://should-not-merge',
        "CLICKPESA_API_KEY='k'",
      ].join('\n'),
    );
    expect(merged['PAYMENT_PROVIDER']).toBe('clickpesa');
    expect(merged['CLICKPESA_CLIENT_ID']).toBe('abc');
    expect(merged['CLICKPESA_API_KEY']).toBe('k');
    expect(merged['DATABASE_URL']).toBeUndefined();
    expect(merged['NODE_ENV']).toBe('development');
  });

  it('formats report without secret values', () => {
    const report = reportClickPesaConfig({
      PAYMENT_PROVIDER: 'clickpesa',
      CLICKPESA_CLIENT_ID: 'secret-client',
      CLICKPESA_API_KEY: 'secret-key',
      CLICKPESA_CHECKSUM_KEY: 'secret-checksum',
    });
    const text = formatClickPesaConfigReport(report);
    expect(text).toContain('effectiveProvider:  clickpesa');
    expect(text).not.toContain('secret-');
    expect(exitCodeForReport(report)).toBe(0);
  });

  it('exits non-zero when clickpesa requested without secrets', () => {
    const report = reportClickPesaConfig({ PAYMENT_PROVIDER: 'clickpesa' });
    expect(exitCodeForReport(report)).toBe(1);
    expect(formatClickPesaConfigReport(report)).toContain('missingSecrets');
  });
});
