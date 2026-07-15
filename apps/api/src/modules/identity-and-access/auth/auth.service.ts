import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import type { AuditPublisher } from '../../platform-operations/index.js';
import { AUDIT_PUBLISHER } from '../../platform-operations/index.js';
import { SessionRepository } from '../repositories/session.repository.js';
import type { LoginRateLimiter } from './login-rate-limiter.js';
import { LOGIN_RATE_LIMITER } from './login-rate-limiter.js';
import { hashPassword, TIMING_DUMMY_PASSWORD_HASH, verifyPassword } from './password-hasher.js';
import {
  ACCESS_TOKEN_PREFIX,
  ACCESS_TOKEN_TTL_SECONDS,
  accessExpiresAt,
  generateOpaqueToken,
  hashToken,
  REFRESH_TOKEN_PREFIX,
  refreshExpiresAt,
} from './session-tokens.js';

export type LoginCommand = {
  readonly email?: unknown;
  readonly password?: unknown;
  readonly tenantId?: unknown;
  readonly idpAssertion?: unknown;
  readonly ip?: string;
  readonly userAgent?: string;
  readonly correlationId: string;
  readonly headerTenantId?: string;
};

export type LoginResult = {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly refreshToken: string;
  readonly requiresMfa: false;
  readonly mfaChallengeToken: null;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
  };
  readonly tenantId: string;
  readonly sessionId: string;
};

export type RefreshResult = {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly refreshToken: string;
};

export type MeResult = {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly status: string;
  };
  readonly memberships: ReadonlyArray<{
    readonly tenantId: string;
    readonly status: string;
    readonly joinedAt: string | null;
  }>;
  readonly activeTenantId: string | null;
  readonly sessionId: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly sessions: SessionRepository,
    @Inject(LOGIN_RATE_LIMITER) private readonly rateLimiter: LoginRateLimiter,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null,
  ) {}

  /**
   * Password login → opaque access + refresh tokens bound to an active membership tenant.
   * IdP assertion path is dual-ready contract only (not implemented yet).
   */
  async login(command: LoginCommand): Promise<LoginResult> {
    if (!this.sessions.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Authentication service is unavailable.', 503);
    }

    if (
      command.idpAssertion !== undefined &&
      command.idpAssertion !== null &&
      command.idpAssertion !== ''
    ) {
      throw AppError.validation('IdP assertion login is not enabled in this environment.');
    }

    const email = normalizeEmail(command.email);
    const password = typeof command.password === 'string' ? command.password : '';
    if (email === undefined || password.length < 8) {
      throw AppError.invalidCredentials();
    }

    const rateKey = `${email}|${command.ip ?? 'unknown'}`;
    const limit = await this.rateLimiter.check(rateKey);
    if (!limit.allowed) {
      throw AppError.rateLimited(
        'Too many login attempts. Try again later.',
        limit.retryAfterSeconds,
      );
    }

    const user = await this.sessions.lookupUserByEmail(email);
    const hashToVerify = user?.passwordHash ?? TIMING_DUMMY_PASSWORD_HASH;
    const passwordOk = await verifyPassword(password, hashToVerify);

    if (
      user === null ||
      user.passwordHash === null ||
      user.passwordHash === '' ||
      !passwordOk ||
      user.status !== 'active'
    ) {
      await this.rateLimiter.recordFailure(rateKey);
      await this.safeAudit({
        action: 'auth.login',
        outcome: 'failure',
        correlationId: command.correlationId,
        metadata: { reason: 'invalid_credentials' },
      });
      throw AppError.invalidCredentials();
    }

    const tenantId = await this.resolveTenantId(user.id, command);
    if (tenantId === undefined) {
      await this.rateLimiter.recordFailure(rateKey);
      await this.safeAudit({
        action: 'auth.login',
        outcome: 'failure',
        correlationId: command.correlationId,
        actorUserId: user.id,
        metadata: { reason: 'tenant_required_or_membership' },
      });
      throw AppError.invalidCredentials();
    }

    const accessToken = generateOpaqueToken(ACCESS_TOKEN_PREFIX);
    const refreshToken = generateOpaqueToken(REFRESH_TOKEN_PREFIX);
    const sessionId = randomUUID();
    const now = new Date();

    try {
      await this.sessions.createSession({
        id: sessionId,
        userId: user.id,
        tenantId,
        sessionTokenHash: hashToken(accessToken),
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: accessExpiresAt(now),
        refreshExpiresAt: refreshExpiresAt(now),
        ...(command.ip !== undefined ? { ip: command.ip } : {}),
        ...(command.userAgent !== undefined ? { userAgent: command.userAgent } : {}),
      });
    } catch {
      await this.safeAudit({
        action: 'auth.login',
        outcome: 'failure',
        correlationId: command.correlationId,
        actorUserId: user.id,
        tenantId,
        metadata: { reason: 'session_create_failed' },
      });
      throw AppError.invalidCredentials();
    }

    await this.rateLimiter.reset(rateKey);
    await this.safeAudit({
      action: 'auth.login',
      outcome: 'success',
      correlationId: command.correlationId,
      actorUserId: user.id,
      tenantId,
      resourceType: 'session',
      resourceId: sessionId,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      requiresMfa: false,
      mfaChallengeToken: null,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      tenantId,
      sessionId,
    };
  }

  async refresh(refreshTokenRaw: unknown, correlationId: string): Promise<RefreshResult> {
    if (!this.sessions.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Authentication service is unavailable.', 503);
    }

    if (typeof refreshTokenRaw !== 'string' || refreshTokenRaw.trim() === '') {
      throw AppError.unauthorized('Invalid or expired refresh token.');
    }

    const refreshToken = refreshTokenRaw.trim();
    const expectedHash = hashToken(refreshToken);
    const session = await this.sessions.findByRefreshTokenHash(expectedHash);

    if (
      session === null ||
      session.status !== 'active' ||
      session.refreshExpiresAt.getTime() <= Date.now()
    ) {
      await this.safeAudit({
        action: 'auth.refresh',
        outcome: 'failure',
        correlationId,
        metadata: { reason: 'invalid_refresh' },
      });
      throw AppError.unauthorized('Invalid or expired refresh token.');
    }

    const membershipOk = await this.sessions.hasActiveMembership(session.userId, session.tenantId);
    if (!membershipOk) {
      await this.sessions.revokeSession(session.id, session.userId);
      throw AppError.unauthorized('Invalid or expired refresh token.');
    }

    const newAccess = generateOpaqueToken(ACCESS_TOKEN_PREFIX);
    const newRefresh = generateOpaqueToken(REFRESH_TOKEN_PREFIX);
    const now = new Date();
    const rotated = await this.sessions.rotateTokens({
      sessionId: session.id,
      expectedRefreshHash: expectedHash,
      newAccessHash: hashToken(newAccess),
      newRefreshHash: hashToken(newRefresh),
      accessExpiresAt: accessExpiresAt(now),
      refreshExpiresAt: refreshExpiresAt(now),
    });

    if (!rotated) {
      await this.sessions.revokeSession(session.id, session.userId);
      await this.safeAudit({
        action: 'auth.refresh',
        outcome: 'denied',
        correlationId,
        actorUserId: session.userId,
        tenantId: session.tenantId,
        resourceType: 'session',
        resourceId: session.id,
        metadata: { reason: 'rotation_conflict' },
      });
      throw AppError.unauthorized('Invalid or expired refresh token.');
    }

    await this.safeAudit({
      action: 'auth.refresh',
      outcome: 'success',
      correlationId,
      actorUserId: session.userId,
      tenantId: session.tenantId,
      resourceType: 'session',
      resourceId: session.id,
    });

    return {
      accessToken: newAccess,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: newRefresh,
    };
  }

  async logout(
    userId: string,
    sessionId: string | undefined,
    correlationId: string,
  ): Promise<void> {
    if (sessionId === undefined || sessionId === '') {
      throw AppError.unauthorized();
    }
    if (!this.sessions.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Authentication service is unavailable.', 503);
    }

    await this.sessions.revokeSession(sessionId, userId);
    await this.safeAudit({
      action: 'auth.logout',
      outcome: 'success',
      correlationId,
      actorUserId: userId,
      resourceType: 'session',
      resourceId: sessionId,
    });
  }

  /** GET /auth/me — current principal + memberships + active session tenant. */
  async me(input: {
    readonly userId: string;
    readonly sessionId?: string;
    readonly tenantId?: string;
  }): Promise<MeResult> {
    if (!this.sessions.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Authentication service is unavailable.', 503);
    }

    const profile = await this.sessions.getUserProfile(input.userId);
    if (profile === null || profile.status !== 'active') {
      throw AppError.unauthorized();
    }

    const memberships = await this.sessions.listMembershipSummaries(input.userId);

    return {
      user: {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        status: profile.status,
      },
      memberships,
      activeTenantId: input.tenantId ?? null,
      sessionId: input.sessionId ?? null,
    };
  }

  /**
   * POST /auth/select-tenant — rebind current session to another active membership tenant.
   * Self-service membership check; optional tenant.read when PolicyEvaluator is available
   * and the caller has role permissions (does not block membership-only users).
   */
  async selectTenant(input: {
    readonly userId: string;
    readonly sessionId: string | undefined;
    readonly tenantId: unknown;
    readonly correlationId: string;
  }): Promise<{ readonly tenantId: string }> {
    if (!this.sessions.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Authentication service is unavailable.', 503);
    }
    if (input.sessionId === undefined || input.sessionId === '') {
      throw AppError.unauthorized();
    }

    const tenantId =
      typeof input.tenantId === 'string' && isUuid(input.tenantId.trim())
        ? input.tenantId.trim().toLowerCase()
        : undefined;
    if (tenantId === undefined) {
      throw AppError.validation('tenantId must be a valid UUID.');
    }

    const membershipOk = await this.sessions.hasActiveMembership(input.userId, tenantId);
    if (!membershipOk) {
      throw AppError.tenantMembershipRequired();
    }

    // Self-service: active membership is the gate (ACF select-tenant). Full RBAC admin is later.
    const rebound = await this.sessions.rebindSessionTenant(
      input.sessionId,
      input.userId,
      tenantId,
    );
    if (!rebound) {
      throw AppError.forbidden('Unable to bind session to the requested tenant.');
    }

    await this.safeAudit({
      action: 'auth.select_tenant',
      outcome: 'success',
      correlationId: input.correlationId,
      actorUserId: input.userId,
      tenantId,
      resourceType: 'session',
      resourceId: input.sessionId,
    });

    return { tenantId };
  }

  /** Test / seed helper — hash only; does not persist. */
  hashPasswordForStorage(password: string): Promise<string> {
    return hashPassword(password);
  }

  private async resolveTenantId(
    userId: string,
    command: LoginCommand,
  ): Promise<string | undefined> {
    const fromBody =
      typeof command.tenantId === 'string' && command.tenantId.trim() !== ''
        ? command.tenantId.trim()
        : undefined;
    const fromHeader =
      command.headerTenantId !== undefined && command.headerTenantId.trim() !== ''
        ? command.headerTenantId.trim()
        : undefined;
    const requested = fromBody ?? fromHeader;

    if (requested !== undefined) {
      if (!isUuid(requested)) {
        return undefined;
      }
      const ok = await this.sessions.hasActiveMembership(userId, requested.toLowerCase());
      return ok ? requested.toLowerCase() : undefined;
    }

    const tenants = await this.sessions.listActiveMembershipTenants(userId);
    if (tenants.length === 1) {
      return tenants[0];
    }
    return undefined;
  }

  private async safeAudit(event: Parameters<AuditPublisher['publish']>[0]): Promise<void> {
    if (this.audit === null) {
      return;
    }
    try {
      await this.audit.publish(event);
    } catch {
      // Audit must not break auth path.
    }
  }
}

function normalizeEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed === '' || !trimmed.includes('@') || trimmed.length > 320) {
    return undefined;
  }
  return trimmed;
}
