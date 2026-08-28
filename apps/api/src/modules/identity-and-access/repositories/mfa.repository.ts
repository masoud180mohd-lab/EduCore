/**
 * MFA factors + challenges persistence (MFA-002 / MFA-003).
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { withUserRlsTransaction } from '../../../common/persistence/user-rls-transaction.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type MfaFactorRow = {
  readonly id: string;
  readonly factorType: string;
  readonly status: string;
  readonly label: string | null;
  readonly confirmedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

@Injectable()
export class MfaRepository {
  constructor(@Optional() @Inject(PG_POOL) private readonly pool: Pool | null) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  async listFactorsForUser(userId: string): Promise<ReadonlyArray<MfaFactorRow>> {
    if (!isUuid(userId) || this.pool === null) return [];
    return withUserRlsTransaction(this.pool, userId, async (client) => {
      const result = await client.query<{
        id: string;
        factor_type: string;
        status: string;
        label: string | null;
        confirmed_at: Date | null;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT id, factor_type, status, label, confirmed_at, created_at, updated_at
         FROM mfa_factors
         WHERE user_id = $1::uuid
         ORDER BY created_at DESC`,
        [userId],
      );
      return result.rows.map((row) => ({
        id: row.id,
        factorType: row.factor_type,
        status: row.status,
        label: row.label,
        confirmedAt: row.confirmed_at?.toISOString() ?? null,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      }));
    });
  }

  async beginTotpEnrollment(input: {
    readonly userId: string;
    readonly factorId: string;
    readonly secretEncrypted: string;
    readonly label: string | null;
    readonly idempotencyKey: string;
  }): Promise<MfaFactorRow> {
    if (this.pool === null) throw new Error('database unavailable');
    const result = await this.pool.query<{
      id: string;
      factor_type: string;
      status: string;
      label: string | null;
      created_at: Date;
    }>(
      `SELECT * FROM app.mfa_begin_totp_enrollment($1::uuid, $2::uuid, $3::text, $4::text, $5::text)`,
      [input.userId, input.factorId, input.secretEncrypted, input.label, input.idempotencyKey],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error('mfa_begin_totp_enrollment returned no row');
    return {
      id: row.id,
      factorType: row.factor_type,
      status: row.status,
      label: row.label,
      confirmedAt: null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.created_at.toISOString(),
    };
  }

  async getPendingTotpSecret(
    userId: string,
    factorId: string,
  ): Promise<{ readonly factorId: string; readonly secretEncrypted: string } | null> {
    if (this.pool === null) return null;
    const result = await this.pool.query<{ factor_id: string; secret_encrypted: string }>(
      `SELECT * FROM app.mfa_get_pending_totp_secret($1::uuid, $2::uuid)`,
      [userId, factorId],
    );
    const row = result.rows[0];
    if (row === undefined || row.secret_encrypted === '') return null;
    return { factorId: row.factor_id, secretEncrypted: row.secret_encrypted };
  }

  async confirmTotpFactor(userId: string, factorId: string): Promise<MfaFactorRow> {
    if (this.pool === null) throw new Error('database unavailable');
    const result = await this.pool.query<{
      id: string;
      factor_type: string;
      status: string;
      label: string | null;
      confirmed_at: Date;
      created_at: Date;
      updated_at: Date;
    }>(`SELECT * FROM app.mfa_confirm_totp_factor($1::uuid, $2::uuid)`, [userId, factorId]);
    const row = result.rows[0];
    if (row === undefined) throw new Error('mfa_confirm_totp_factor returned no row');
    return {
      id: row.id,
      factorType: row.factor_type,
      status: row.status,
      label: row.label,
      confirmedAt: row.confirmed_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async disableFactor(userId: string, factorId: string): Promise<MfaFactorRow> {
    if (this.pool === null) throw new Error('database unavailable');
    const result = await this.pool.query<{
      id: string;
      factor_type: string;
      status: string;
      updated_at: Date;
    }>(`SELECT * FROM app.mfa_disable_factor($1::uuid, $2::uuid)`, [userId, factorId]);
    const row = result.rows[0];
    if (row === undefined) throw new Error('mfa_disable_factor returned no row');
    return {
      id: row.id,
      factorType: row.factor_type,
      status: row.status,
      label: null,
      confirmedAt: null,
      createdAt: row.updated_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async hasActiveTotp(userId: string): Promise<boolean> {
    if (this.pool === null || !isUuid(userId)) return false;
    const result = await this.pool.query<{ has: boolean }>(
      `SELECT app.auth_user_has_active_totp($1::uuid) AS has`,
      [userId],
    );
    return result.rows[0]?.has === true;
  }

  async isPrivileged(userId: string, tenantId: string): Promise<boolean> {
    if (this.pool === null || !isUuid(userId) || !isUuid(tenantId)) return false;
    const result = await this.pool.query<{ has: boolean }>(
      `SELECT app.auth_user_has_privileged_mfa_perm($1::uuid, $2::uuid) AS has`,
      [userId, tenantId],
    );
    return result.rows[0]?.has === true;
  }

  async getActiveTotpSecret(
    userId: string,
  ): Promise<{ readonly factorId: string; readonly secretEncrypted: string } | null> {
    if (this.pool === null) return null;
    const result = await this.pool.query<{ factor_id: string; secret_encrypted: string }>(
      `SELECT * FROM app.mfa_get_active_totp_secret($1::uuid)`,
      [userId],
    );
    const row = result.rows[0];
    if (row === undefined || row.secret_encrypted === '') return null;
    return { factorId: row.factor_id, secretEncrypted: row.secret_encrypted };
  }

  async createChallenge(input: {
    readonly challengeId: string;
    readonly userId: string;
    readonly tenantId: string;
    readonly challengeTokenHash: string;
    readonly expiresAt: Date;
    readonly ip?: string;
    readonly userAgent?: string;
  }): Promise<void> {
    if (this.pool === null) throw new Error('database unavailable');
    await this.pool.query(
      `SELECT app.mfa_create_challenge($1::uuid, $2::uuid, $3::uuid, $4::text, $5::timestamptz, $6::inet, $7::text)`,
      [
        input.challengeId,
        input.userId,
        input.tenantId,
        input.challengeTokenHash,
        input.expiresAt.toISOString(),
        input.ip ?? null,
        input.userAgent ?? null,
      ],
    );
  }

  async getPendingChallenge(challengeTokenHash: string): Promise<{
    readonly challengeId: string;
    readonly userId: string;
    readonly tenantId: string;
  } | null> {
    if (this.pool === null) return null;
    try {
      const result = await this.pool.query<{
        challenge_id: string;
        user_id: string;
        tenant_id: string;
      }>(`SELECT * FROM app.mfa_get_pending_challenge($1::text)`, [challengeTokenHash]);
      const row = result.rows[0];
      if (row === undefined) return null;
      return {
        challengeId: row.challenge_id,
        userId: row.user_id,
        tenantId: row.tenant_id,
      };
    } catch {
      return null;
    }
  }

  async consumeChallenge(challengeTokenHash: string): Promise<{
    readonly challengeId: string;
    readonly userId: string;
    readonly tenantId: string;
  } | null> {
    if (this.pool === null) return null;
    try {
      const result = await this.pool.query<{
        challenge_id: string;
        user_id: string;
        tenant_id: string;
      }>(`SELECT * FROM app.mfa_consume_challenge($1::text)`, [challengeTokenHash]);
      const row = result.rows[0];
      if (row === undefined) return null;
      return {
        challengeId: row.challenge_id,
        userId: row.user_id,
        tenantId: row.tenant_id,
      };
    } catch {
      return null;
    }
  }
}
