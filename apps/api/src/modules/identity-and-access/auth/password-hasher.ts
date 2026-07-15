import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

/** scrypt params: N=16384, r=8, p=1, keylen=32 — suitable for local/server passwords. */
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;

const PREFIX = 'scrypt';

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, derivedKey) => {
      if (err !== null) {
        reject(err);
        return;
      }
      resolve(derivedKey);
    });
  });
}

/**
 * Hash a password for storage. Format: scrypt$N$r$p$saltB64$keyB64
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scryptAsync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return [
    PREFIX,
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

/**
 * Constant-time verify. Returns false for malformed hashes (no throw).
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) {
    return false;
  }
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltB64 = parts[4];
  const keyB64 = parts[5];
  if (
    !Number.isInteger(n) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    saltB64 === undefined ||
    keyB64 === undefined
  ) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltB64, 'base64url');
    expected = Buffer.from(keyB64, 'base64url');
  } catch {
    return false;
  }

  if (expected.length !== KEY_LEN) {
    return false;
  }

  try {
    const actual = await scryptAsync(password, salt, expected.length, {
      N: n,
      r,
      p,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Dummy hash used when user is missing so verify still runs (timing hardening).
 * Password material is not a real account secret.
 */
export const TIMING_DUMMY_PASSWORD_HASH =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
