/**
 * Encrypt TOTP secrets at rest (MFA-001). AES-256-GCM.
 * Key: MFA_TOTP_ENCRYPTION_KEY as 32-byte base64 or 64-char hex.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';

export function loadMfaEncryptionKey(environment: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = environment['MFA_TOTP_ENCRYPTION_KEY']?.trim() ?? '';
  if (raw === '') return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  try {
    const buf = Buffer.from(raw, 'base64');
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

export function encryptTotpSecret(plainBase32: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainBase32, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptTotpSecret(payload: string, key: Buffer): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Invalid encrypted TOTP payload.');
  }
  const iv = Buffer.from(parts[1]!, 'base64url');
  const tag = Buffer.from(parts[2]!, 'base64url');
  const ciphertext = Buffer.from(parts[3]!, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function resolveMfaEnforceMode(
  environment: NodeJS.ProcessEnv = process.env,
): 'soft' | 'hard' {
  const raw = (environment['MFA_ENFORCE'] ?? 'soft').trim().toLowerCase();
  return raw === 'hard' ? 'hard' : 'soft';
}

export const PRIVILEGED_MFA_PERMISSIONS = [
  'finance.manage',
  'tenant.manage',
  'role.manage',
] as const;

export function isPrivilegedPermissionSet(permissions: ReadonlySet<string>): boolean {
  return PRIVILEGED_MFA_PERMISSIONS.some((code) => permissions.has(code));
}
