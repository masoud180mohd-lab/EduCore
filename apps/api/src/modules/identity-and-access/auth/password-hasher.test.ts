import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password-hasher.js';

describe('password hasher (scrypt)', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(hash.startsWith('scrypt$')).toBe(true);
    await expect(verifyPassword('correct-horse-battery', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password-xx', hash)).resolves.toBe(false);
  });

  it('rejects malformed stored hashes without throwing', async () => {
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
  });
});
