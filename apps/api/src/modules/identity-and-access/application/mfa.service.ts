/**
 * MFA factor enrollment + login challenge helpers (MFA-003 / MFA-004).
 */
import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import { assertIdempotencyKey } from '../../../common/idempotency/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  loadMfaEncryptionKey,
  resolveMfaEnforceMode,
} from '../auth/mfa-crypto.js';
import { generateOpaqueToken, hashToken } from '../auth/session-tokens.js';
import { buildOtpAuthUri, generateTotpSecretBase32, verifyTotpCode } from '../auth/totp.js';
import { MfaRepository, type MfaFactorRow } from '../repositories/mfa.repository.js';

const MFA_CHALLENGE_PREFIX = 'ecm_';
const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const ISSUER = 'EduCore';

@Injectable()
export class MfaService {
  constructor(private readonly mfa: MfaRepository) {}

  async listFactors(userId: string): Promise<{ readonly data: ReadonlyArray<MfaFactorPublic> }> {
    if (!isUuid(userId)) throw AppError.unauthorized();
    if (!this.mfa.isAvailable()) return { data: [] };
    const rows = await this.mfa.listFactorsForUser(userId);
    return { data: rows.map(toPublic) };
  }

  async beginTotpEnrollment(
    userId: string,
    email: string,
    rawBody: unknown,
    idempotencyKeyHeader: string | undefined,
  ): Promise<{
    readonly data: MfaFactorPublic & {
      readonly secret: string;
      readonly otpauthUri: string;
    };
  }> {
    if (!isUuid(userId)) throw AppError.unauthorized();
    if (!this.mfa.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'MFA store unavailable.');
    }
    const key = loadMfaEncryptionKey();
    if (key === null) {
      throw new AppError('INTERNAL_ERROR', 'MFA_TOTP_ENCRYPTION_KEY is not configured.');
    }
    assertIdempotencyKey(idempotencyKeyHeader);
    const label = parseBeginBody(rawBody);
    if (await this.mfa.hasActiveTotp(userId)) {
      throw new AppError('CONFLICT', 'An active TOTP factor already exists.');
    }

    const secret = generateTotpSecretBase32();
    const factorId = randomUUID();
    try {
      const row = await this.mfa.beginTotpEnrollment({
        userId,
        factorId,
        secretEncrypted: encryptTotpSecret(secret, key),
        label,
        idempotencyKey: idempotencyKeyHeader!.trim(),
      });
      return {
        data: {
          ...toPublic(row),
          secret,
          otpauthUri: buildOtpAuthUri({
            secretBase32: secret,
            accountName: email,
            issuer: ISSUER,
          }),
        },
      };
    } catch (error: unknown) {
      if (isPgUnique(error)) {
        throw new AppError('CONFLICT', 'An active TOTP factor already exists.');
      }
      throw new AppError('INTERNAL_ERROR', 'Failed to begin MFA enrollment.');
    }
  }

  async confirmTotp(
    userId: string,
    factorId: string,
    rawBody: unknown,
  ): Promise<{ readonly data: MfaFactorPublic }> {
    if (!isUuid(userId)) throw AppError.unauthorized();
    if (!isUuid(factorId)) throw AppError.notFound('MFA factor not found.');
    if (!this.mfa.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'MFA store unavailable.');
    }
    const key = loadMfaEncryptionKey();
    if (key === null) {
      throw new AppError('INTERNAL_ERROR', 'MFA_TOTP_ENCRYPTION_KEY is not configured.');
    }
    const code = parseCode(rawBody);
    const pending = await this.mfa.getPendingTotpSecret(userId, factorId);
    if (pending === null) throw AppError.notFound('MFA factor not found.');
    let secret: string;
    try {
      secret = decryptTotpSecret(pending.secretEncrypted, key);
    } catch {
      throw new AppError('INTERNAL_ERROR', 'Failed to decrypt MFA secret.');
    }
    if (!verifyTotpCode(secret, code)) {
      throw new AppError('MFA_INVALID', 'Invalid MFA code.');
    }
    try {
      const row = await this.mfa.confirmTotpFactor(userId, factorId);
      return { data: toPublic(row) };
    } catch {
      throw AppError.notFound('MFA factor not found.');
    }
  }

  async disableFactor(
    userId: string,
    factorId: string,
  ): Promise<{ readonly data: MfaFactorPublic }> {
    if (!isUuid(userId)) throw AppError.unauthorized();
    if (!isUuid(factorId)) throw AppError.notFound('MFA factor not found.');
    if (!this.mfa.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'MFA store unavailable.');
    }
    try {
      const row = await this.mfa.disableFactor(userId, factorId);
      return { data: toPublic(row) };
    } catch {
      throw AppError.notFound('MFA factor not found.');
    }
  }

  async createLoginChallenge(input: {
    readonly userId: string;
    readonly tenantId: string;
    readonly ip?: string;
    readonly userAgent?: string;
  }): Promise<string> {
    if (!this.mfa.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'MFA store unavailable.');
    }
    const raw = generateOpaqueToken(MFA_CHALLENGE_PREFIX);
    const challengeId = randomUUID();
    await this.mfa.createChallenge({
      challengeId,
      userId: input.userId,
      tenantId: input.tenantId,
      challengeTokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + MFA_CHALLENGE_TTL_MS),
      ...(input.ip !== undefined ? { ip: input.ip } : {}),
      ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
    });
    return raw;
  }

  async verifyLoginChallenge(input: {
    readonly mfaChallengeToken: unknown;
    readonly code: unknown;
  }): Promise<{ readonly userId: string; readonly tenantId: string }> {
    if (!this.mfa.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'MFA store unavailable.');
    }
    const key = loadMfaEncryptionKey();
    if (key === null) {
      throw new AppError('INTERNAL_ERROR', 'MFA_TOTP_ENCRYPTION_KEY is not configured.');
    }
    const token = typeof input.mfaChallengeToken === 'string' ? input.mfaChallengeToken.trim() : '';
    if (token === '') {
      throw AppError.validation('mfaChallengeToken is required.', {
        field: 'mfaChallengeToken',
      });
    }
    const code = parseCode({ code: input.code });
    const consumed = await this.mfa.consumeChallenge(hashToken(token));
    if (consumed === null) {
      throw new AppError('MFA_INVALID', 'Invalid or expired MFA challenge.');
    }
    const active = await this.mfa.getActiveTotpSecret(consumed.userId);
    if (active === null) {
      throw new AppError('MFA_INVALID', 'No active MFA factor.');
    }
    let secret: string;
    try {
      secret = decryptTotpSecret(active.secretEncrypted, key);
    } catch {
      throw new AppError('INTERNAL_ERROR', 'Failed to decrypt MFA secret.');
    }
    if (!verifyTotpCode(secret, code)) {
      throw new AppError('MFA_INVALID', 'Invalid MFA code.');
    }
    return { userId: consumed.userId, tenantId: consumed.tenantId };
  }

  enforceMode(): 'soft' | 'hard' {
    return resolveMfaEnforceMode();
  }
}

export type MfaFactorPublic = {
  readonly id: string;
  readonly factorType: string;
  readonly status: string;
  readonly label: string | null;
  readonly confirmedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function toPublic(row: MfaFactorRow): MfaFactorPublic {
  return {
    id: row.id,
    factorType: row.factorType,
    status: row.status,
    label: row.label,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseBeginBody(raw: unknown): string | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const body = raw as Record<string, unknown>;
  const factorType = body['factorType'];
  if (factorType !== undefined && factorType !== 'totp') {
    throw AppError.validation('Only factorType=totp is supported in v1.', {
      field: 'factorType',
    });
  }
  const label = body['label'];
  if (label === undefined || label === null || label === '') return null;
  if (typeof label !== 'string' || label.trim().length > 64) {
    throw AppError.validation('label must be a string ≤ 64 chars.', { field: 'label' });
  }
  return label.trim();
}

function parseCode(raw: unknown): string {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw AppError.validation('Body must be a JSON object.');
  }
  const code = (raw as Record<string, unknown>)['code'];
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    throw AppError.validation('code must be a 6-digit string.', { field: 'code' });
  }
  return code.trim();
}

function isPgUnique(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}
