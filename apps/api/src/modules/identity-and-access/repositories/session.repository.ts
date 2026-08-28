import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool } from 'pg';

import { logFailClosedDbError } from '../../../common/logging/fail-closed-log.js';
import type { AppLogger } from '../../../common/logging/logger.js';
import { APP_LOGGER } from '../../../common/logging/logger.tokens.js';
import { PG_POOL } from '../../../common/persistence/pg.tokens.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';

export type UserCredentialRow = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: string;
  readonly passwordHash: string | null;
};

export type SessionRow = {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly status: string;
  readonly expiresAt: Date;
  readonly refreshExpiresAt: Date;
};

export type CreateSessionInput = {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly sessionTokenHash: string;
  readonly refreshTokenHash: string;
  readonly expiresAt: Date;
  readonly refreshExpiresAt: Date;
  readonly ip?: string;
  readonly userAgent?: string;
};

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

/**
 * Session + login credential access via SECURITY DEFINER helpers (IMP-001 P3).
 * Repository is private to Identity And Access (not exported on public barrel).
 */
@Injectable()
export class SessionRepository {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: Pool | null,
    @Optional() @Inject(APP_LOGGER) private readonly logger: AppLogger | null = null,
  ) {}

  isAvailable(): boolean {
    return this.pool !== null;
  }

  async lookupUserByEmail(email: string): Promise<UserCredentialRow | null> {
    if (this.pool === null) {
      return null;
    }
    const result = await this.pool.query<{
      id: string;
      email: string;
      display_name: string;
      status: string;
      password_hash: string | null;
    }>(`SELECT * FROM app.auth_lookup_user_by_email($1::citext)`, [email]);
    return mapUserCredential(result.rows[0]);
  }

  /** Accept invite: sets password and activates user + membership. */
  async acceptInvite(
    email: string,
    passwordHash: string,
    displayName?: string,
  ): Promise<UserCredentialRow | null> {
    if (this.pool === null) {
      return null;
    }
    const result = await this.pool.query<{
      id: string;
      email: string;
      display_name: string;
      status: string;
    }>(
      `SELECT id, email, display_name, status
         FROM app.auth_accept_invite($1::citext, $2::text, $3::text)`,
      [email, passwordHash, displayName ?? null],
    );
    const row = result.rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      status: row.status,
      passwordHash,
    };
  }

  async lookupUserByExternalSubject(subject: string): Promise<UserCredentialRow | null> {
    if (this.pool === null) {
      return null;
    }
    const result = await this.pool.query<{
      id: string;
      email: string;
      display_name: string;
      status: string;
      password_hash: string | null;
    }>(`SELECT * FROM app.auth_lookup_user_by_external_subject($1::text)`, [subject]);
    return mapUserCredential(result.rows[0]);
  }

  /** First-link Auth0/OIDC sub onto an existing active user (null or same subject only). */
  async linkExternalSubject(userId: string, subject: string): Promise<boolean> {
    if (this.pool === null) {
      return false;
    }
    const result = await this.pool.query<{ ok: boolean }>(
      `SELECT app.auth_link_external_subject($1::uuid, $2::text) AS ok`,
      [userId, subject],
    );
    return result.rows[0]?.ok === true;
  }

  async listActiveMembershipTenants(userId: string): Promise<readonly string[]> {
    if (this.pool === null) {
      return [];
    }
    const result = await this.pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM app.auth_list_active_membership_tenants($1::uuid)`,
      [userId],
    );
    return result.rows.map((r) => r.tenant_id);
  }

  async hasActiveMembership(userId: string, tenantId: string): Promise<boolean> {
    if (this.pool === null) {
      return false;
    }
    const result = await this.pool.query<{ ok: boolean }>(
      `SELECT app.auth_has_active_membership($1::uuid, $2::uuid) AS ok`,
      [userId, tenantId],
    );
    return result.rows[0]?.ok === true;
  }

  async createSession(input: CreateSessionInput): Promise<string> {
    if (this.pool === null) {
      throw new Error('Session store unavailable');
    }
    const result = await this.pool.query<{ id: string }>(
      `SELECT app.auth_create_session(
         $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text,
         $6::timestamptz, $7::timestamptz, $8::inet, $9::text
       ) AS id`,
      [
        input.id,
        input.userId,
        input.tenantId,
        input.sessionTokenHash,
        input.refreshTokenHash,
        input.expiresAt.toISOString(),
        input.refreshExpiresAt.toISOString(),
        input.ip ?? null,
        input.userAgent ?? null,
      ],
    );
    const id = result.rows[0]?.id;
    if (id === undefined) {
      throw new Error('Session create failed');
    }
    return id;
  }

  async findByAccessTokenHash(hash: string): Promise<SessionRow | null> {
    if (this.pool === null) {
      return null;
    }
    const result = await this.pool.query<{
      id: string;
      user_id: string;
      tenant_id: string;
      status: string;
      expires_at: Date;
      refresh_expires_at: Date;
    }>(`SELECT * FROM app.auth_find_session_by_access_hash($1::text)`, [hash]);
    return mapSession(result.rows[0]);
  }

  async findByRefreshTokenHash(hash: string): Promise<SessionRow | null> {
    if (this.pool === null) {
      return null;
    }
    const result = await this.pool.query<{
      id: string;
      user_id: string;
      tenant_id: string;
      status: string;
      expires_at: Date;
      refresh_expires_at: Date;
    }>(`SELECT * FROM app.auth_find_session_by_refresh_hash($1::text)`, [hash]);
    return mapSession(result.rows[0]);
  }

  async touchSession(sessionId: string): Promise<void> {
    if (this.pool === null) {
      return;
    }
    await this.pool.query(`SELECT app.auth_touch_session($1::uuid)`, [sessionId]);
  }

  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    if (this.pool === null) {
      return false;
    }
    const result = await this.pool.query<{ ok: boolean }>(
      `SELECT app.auth_revoke_session($1::uuid, $2::uuid) AS ok`,
      [sessionId, userId],
    );
    return result.rows[0]?.ok === true;
  }

  async rotateTokens(input: {
    readonly sessionId: string;
    readonly expectedRefreshHash: string;
    readonly newAccessHash: string;
    readonly newRefreshHash: string;
    readonly accessExpiresAt: Date;
    readonly refreshExpiresAt: Date;
  }): Promise<boolean> {
    if (this.pool === null) {
      return false;
    }
    const result = await this.pool.query<{ ok: boolean }>(
      `SELECT app.auth_rotate_session_tokens(
         $1::uuid, $2::text, $3::text, $4::text, $5::timestamptz, $6::timestamptz
       ) AS ok`,
      [
        input.sessionId,
        input.expectedRefreshHash,
        input.newAccessHash,
        input.newRefreshHash,
        input.accessExpiresAt.toISOString(),
        input.refreshExpiresAt.toISOString(),
      ],
    );
    return result.rows[0]?.ok === true;
  }

  async getUserProfile(userId: string): Promise<{
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly status: string;
  } | null> {
    if (this.pool === null) {
      return null;
    }
    const result = await this.pool.query<{
      id: string;
      email: string;
      display_name: string;
      status: string;
    }>(`SELECT * FROM app.auth_get_user_profile($1::uuid)`, [userId]);
    const row = result.rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      status: row.status,
    };
  }

  async listMembershipSummaries(userId: string): Promise<
    ReadonlyArray<{
      readonly tenantId: string;
      readonly status: string;
      readonly joinedAt: string | null;
    }>
  > {
    if (this.pool === null) {
      return [];
    }
    const result = await this.pool.query<{
      tenant_id: string;
      status: string;
      joined_at: Date | null;
    }>(`SELECT * FROM app.auth_list_membership_summaries($1::uuid)`, [userId]);
    return result.rows.map((row) => ({
      tenantId: row.tenant_id,
      status: row.status,
      joinedAt: row.joined_at === null ? null : new Date(row.joined_at).toISOString(),
    }));
  }

  async isActivePlatformSuperAdmin(userId: string): Promise<boolean> {
    if (this.pool === null || !isUuid(userId)) {
      return false;
    }
    try {
      const result = await this.pool.query<{ user_id: string }>(
        `SELECT user_id
           FROM platform_operators
          WHERE user_id = $1::uuid
            AND status = 'active'
            AND role = 'super_admin'
          LIMIT 1`,
        [userId],
      );
      return result.rows[0] !== undefined;
    } catch (error) {
      logFailClosedDbError(this.logger, 'platform_operators.me_lookup', error);
      return false;
    }
  }

  async rebindSessionTenant(sessionId: string, userId: string, tenantId: string): Promise<boolean> {
    if (this.pool === null) {
      return false;
    }
    const result = await this.pool.query<{ ok: boolean }>(
      `SELECT app.auth_rebind_session_tenant($1::uuid, $2::uuid, $3::uuid) AS ok`,
      [sessionId, userId, tenantId],
    );
    return result.rows[0]?.ok === true;
  }
}

function mapUserCredential(
  row:
    | {
        id: string;
        email: string;
        display_name: string;
        status: string;
        password_hash: string | null;
      }
    | undefined,
): UserCredentialRow | null {
  if (row === undefined) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    passwordHash: row.password_hash,
  };
}

function mapSession(
  row:
    | {
        id: string;
        user_id: string;
        tenant_id: string;
        status: string;
        expires_at: Date;
        refresh_expires_at: Date;
      }
    | undefined,
): SessionRow | null {
  if (row === undefined) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    status: row.status,
    expiresAt: new Date(row.expires_at),
    refreshExpiresAt: new Date(row.refresh_expires_at),
  };
}
