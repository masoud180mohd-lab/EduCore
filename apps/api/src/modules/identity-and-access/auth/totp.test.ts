import { describe, expect, it } from 'vitest';

import {
  buildOtpAuthUri,
  generateTotpCode,
  generateTotpSecretBase32,
  verifyTotpCode,
} from './totp.js';

describe('totp', () => {
  it('generates and verifies codes within window', () => {
    const secret = generateTotpSecretBase32();
    const code = generateTotpCode(secret);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotpCode(secret, code)).toBe(true);
    expect(verifyTotpCode(secret, '000000')).toBe(false);
  });

  it('builds otpauth uri', () => {
    const uri = buildOtpAuthUri({
      secretBase32: 'JBSWY3DPEHPK3PXP',
      accountName: 'admin@educore.local',
      issuer: 'EduCore',
    });
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
  });
});
