import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  decryptTotpSecret,
  encryptTotpSecret,
  loadMfaEncryptionKey,
  resolveMfaEnforceMode,
} from './mfa-crypto.js';

describe('mfa-crypto', () => {
  it('round-trips encrypted secrets', () => {
    const key = randomBytes(32);
    const enc = encryptTotpSecret('JBSWY3DPEHPK3PXP', key);
    expect(enc.startsWith('v1.')).toBe(true);
    expect(decryptTotpSecret(enc, key)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('loads hex key and resolve enforce mode', () => {
    const hex = randomBytes(32).toString('hex');
    expect(loadMfaEncryptionKey({ MFA_TOTP_ENCRYPTION_KEY: hex })?.length).toBe(32);
    expect(resolveMfaEnforceMode({ MFA_ENFORCE: 'hard' })).toBe('hard');
    expect(resolveMfaEnforceMode({})).toBe('soft');
  });
});
