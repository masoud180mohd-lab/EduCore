/**
 * RFC 6238 TOTP (SHA-1, 30s, 6 digits) — no vendor SDK (MFA-001).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const PERIOD_SECONDS = 30;
const DIGITS = 6;

export function generateTotpSecretBase32(bytes = 20): string {
  return toBase32(randomBytes(bytes));
}

export function buildOtpAuthUri(input: {
  readonly secretBase32: string;
  readonly accountName: string;
  readonly issuer: string;
}): string {
  const label = encodeURIComponent(`${input.issuer}:${input.accountName}`);
  const params = new URLSearchParams({
    secret: input.secretBase32,
    issuer: input.issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function generateTotpCode(secretBase32: string, atMs: number = Date.now()): string {
  const key = fromBase32(secretBase32);
  const counter = Math.floor(atMs / 1000 / PERIOD_SECONDS);
  return hotp(key, counter);
}

/** Accept current ±1 time step. */
export function verifyTotpCode(
  secretBase32: string,
  code: string,
  atMs: number = Date.now(),
): boolean {
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  for (const step of [-1, 0, 1]) {
    const expected = generateTotpCode(secretBase32, atMs + step * PERIOD_SECONDS * 1000);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(normalized, 'utf8');
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const otp = binary % 10 ** DIGITS;
  return String(otp).padStart(DIGITS, '0');
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function toBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function fromBase32(secret: string): Buffer {
  const cleaned = secret.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32 secret.');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
