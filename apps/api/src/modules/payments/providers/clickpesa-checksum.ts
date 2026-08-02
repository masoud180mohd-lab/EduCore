/**
 * ClickPesa HMAC-SHA256 payload checksum (PAY-002 / PAY-004).
 * Canonicalize (recursive key sort) → compact JSON → HMAC-SHA256 hex.
 * Exclude `checksum` and `checksumMethod` before hashing.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export function canonicalizeForChecksum(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalizeForChecksum);
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = canonicalizeForChecksum(obj[key]);
  }
  return sorted;
}

export function stripChecksumFields(payload: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'checksum' || key === 'checksumMethod') continue;
    next[key] = value;
  }
  return next;
}

export function createClickPesaPayloadChecksum(
  checksumKey: string,
  payload: Record<string, unknown>,
): string {
  const prepared = stripChecksumFields(payload);
  const canonical = canonicalizeForChecksum(prepared);
  const payloadString = JSON.stringify(canonical);
  return createHmac('sha256', checksumKey).update(payloadString).digest('hex');
}

export function verifyClickPesaPayloadChecksum(
  checksumKey: string,
  payload: Record<string, unknown>,
  receivedChecksum: string,
): boolean {
  const expected = createClickPesaPayloadChecksum(checksumKey, payload);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(receivedChecksum, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
