import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import { PERMISSION_SOURCE } from '../../../common/policy/index.js';
import type { PermissionSource } from '../../../common/policy/policy-evaluator.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import type { AuditPublisher } from '../../platform-operations/index.js';
import { AUDIT_PUBLISHER } from '../../platform-operations/index.js';
import { RbacReadRepository } from '../rbac/rbac-read.repository.js';
import { MfaService } from '../application/mfa.service.js';
import { SessionRepository, type UserCredentialRow } from '../repositories/session.repository.js';
import { resolveAuthIdpProvider } from './auth-idp-config.js';
import type { LoginRateLimiter } from './login-rate-limiter.js';
import { LOGIN_RATE_LIMITER } from './login-rate-limiter.js';
import {
  DisabledIdpAssertionVerifier,
  IDP_ASSERTION_VERIFIER,
  type IdpAssertionVerifier,
  type IdpVerifiedClaims,
} from './idp-assertion.verifier.js';
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
import { resolveMfaEnforceMode } from './mfa-crypto.js';
import { MfaRepository } from '../repositories/mfa.repository.js';

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
  readonly accessToken: string | null;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly refreshToken: string | null;
  readonly requiresMfa: boolean;
  readonly mfaChallengeToken: string | null;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
  };
  readonly tenantId: string;
  readonly sessionId: string | null;
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
  /**
   * Roles in the active tenant only when membership is active
   * (same membership gate as `permissions`; empty when unbound / inactive / revoked).
   */
  readonly roles: ReadonlyArray<{
    readonly code: string;
    readonly name: string;
    readonly isSystem: boolean;
  }>;
  /**
   * Effective permission codes for active tenant only when membership is active
   * (via MembershipAwarePermissionSource; empty when unbound / inactive / revoked).
   */
  readonly permissions: ReadonlyArray<string>;
  /** MFA-005: privileged role without active TOTP. */
  readonly mfaEnrollmentRequired: boolean;
  /** MFA-005: soft | hard from MFA_ENFORCE. */
  readonly mfaEnforced: 'soft' | 'hard';
  readonly mfaActive: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly sessions: SessionRepository,
    @Inject(LOGIN_RATE_LIMITER) private readonly rateLimiter: LoginRateLimiter,
    @Optional() @Inject(AUDIT_PUBLISHER) private readonly audit: AuditPublisher | null = null,
    /** Required: same module provider — must not silently skip roles on /auth/me. */
    private readonly rbacRead: RbacReadRepository,
    @Optional()
    @Inject(PERMISSION_SOURCE)
    private readonly permissionSource: PermissionSource | null = null,
    private readonly mfa: MfaService,
    private readonly mfaRepo: MfaRepository,
    @Optional()
    @Inject(IDP_ASSERTION_VERIFIER)
    private readonly idpVerifier: IdpAssertionVerifier | null = null,
  ) {}

  /**
   * Password login → opaque access + refresh tokens bound to an active membership tenant.
   * IdP assertion (Auth0) when AUTH_IDP_PROVIDER=auth0 — still mints EduCore opaque sessions.
   */
  async login(command: LoginCommand): Promise<LoginResult> {
    if (!this.sessions.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Authentication service is unavailable.', 503);
    }

    if (hasIdpAssertion(command.idpAssertion)) {
      return this.loginWithIdpAssertion(command);
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

    return this.finalizeAuthenticatedLogin({
      user,
      command,
      rateKey,
      authMethod: 'password',
    });
  }

  private async loginWithIdpAssertion(command: LoginCommand): Promise<LoginResult> {
    if (resolveAuthIdpProvider() !== 'auth0') {
      throw AppError.validation('IdP assertion login is not enabled in this environment.');
    }

    const verifier = this.idpVerifier ?? new DisabledIdpAssertionVerifier();
    const claims = await verifier.verify(command.idpAssertion);

    const rateKey = `idp:${claims.subject}|${command.ip ?? 'unknown'}`;
    const limit = await this.rateLimiter.check(rateKey);
    if (!limit.allowed) {
      throw AppError.rateLimited(
        'Too many login attempts. Try again later.',
        limit.retryAfterSeconds,
      );
    }

    const user = await this.resolveUserFromIdpClaims(claims);
    if (user === null || user.status !== 'active') {
      await this.rateLimiter.recordFailure(rateKey);
      await this.safeAudit({
        action: 'auth.login',
        outcome: 'failure',
        correlationId: command.correlationId,
        metadata: { reason: 'idp_user_unmapped', provider: 'auth0' },
      });
      throw AppError.invalidCredentials();
    }

    return this.finalizeAuthenticatedLogin({
      user,
      command,
      rateKey,
      authMethod: 'auth0',
    });
  }

  /**
   * Map Auth0 `sub` → EduCore user. Prefer external_subject_id; optional first-link by
   * verified email when subject is unset. Never auto-provisions users.
   */
  private async resolveUserFromIdpClaims(
    claims: IdpVerifiedClaims,
  ): Promise<UserCredentialRow | null> {
    const bySubject = await this.sessions.lookupUserByExternalSubject(claims.subject);
    if (bySubject !== null) {
      return bySubject;
    }

    if (!claims.emailVerified || claims.email === null) {
      const allowUnverified = process.env['AUTH0_ALLOW_UNVERIFIED_EMAIL_LINK']?.trim() === '1';
      if (!allowUnverified || claims.email === null) {
        return null;
      }
      // Staging/lab: Auth0 DB signup often leaves email_verified=false until inbox confirm.
    }

    const byEmail = await this.sessions.lookupUserByEmail(claims.email);
    if (byEmail === null || byEmail.status !== 'active') {
      return null;
    }

    const linked = await this.sessions.linkExternalSubject(byEmail.id, claims.subject);
    if (!linked) {
      return null;
    }

    return this.sessions.lookupUserByExternalSubject(claims.subject);
  }

  private async finalizeAuthenticatedLogin(input: {
    readonly user: UserCredentialRow;
    readonly command: LoginCommand;
    readonly rateKey: string;
    readonly authMethod: 'password' | 'auth0';
  }): Promise<LoginResult> {
    const { user, command, rateKey, authMethod } = input;

    const tenantId = await this.resolveTenantId(user.id, command);
    if (tenantId === undefined) {
      await this.rateLimiter.recordFailure(rateKey);
      await this.safeAudit({
        action: 'auth.login',
        outcome: 'failure',
        correlationId: command.correlationId,
        actorUserId: user.id,
        metadata: { reason: 'tenant_required_or_membership', authMethod },
      });
      throw AppError.invalidCredentials();
    }

    const enforce = resolveMfaEnforceMode();

    if (enforce === 'hard' && !this.mfaRepo.isAvailable()) {
      await this.safeAudit({
        action: 'auth.login',
        outcome: 'failure',
        correlationId: command.correlationId,
        actorUserId: user.id,
        tenantId,
        metadata: { reason: 'mfa_store_unavailable', authMethod },
      });
      throw new AppError(
        'MFA_REQUIRED',
        'MFA store unavailable; login denied under MFA_ENFORCE=hard.',
      );
    }

    const hasTotp = this.mfaRepo.isAvailable() ? await this.mfaRepo.hasActiveTotp(user.id) : false;
    const privileged = this.mfaRepo.isAvailable()
      ? await this.mfaRepo.isPrivileged(user.id, tenantId)
      : false;

    if (privileged && !hasTotp && enforce === 'hard') {
      await this.safeAudit({
        action: 'auth.login',
        outcome: 'failure',
        correlationId: command.correlationId,
        actorUserId: user.id,
        tenantId,
        metadata: { reason: 'mfa_enrollment_required', authMethod },
      });
      throw new AppError(
        'MFA_REQUIRED',
        'Privileged accounts must enroll TOTP before login (MFA_ENFORCE=hard).',
      );
    }

    if (hasTotp) {
      const mfaChallengeToken = await this.mfa.createLoginChallenge({
        userId: user.id,
        tenantId,
        ...(command.ip !== undefined ? { ip: command.ip } : {}),
        ...(command.userAgent !== undefined ? { userAgent: command.userAgent } : {}),
      });
      await this.rateLimiter.reset(rateKey);
      await this.safeAudit({
        action: 'auth.login',
        outcome: 'success',
        correlationId: command.correlationId,
        actorUserId: user.id,
        tenantId,
        metadata: { requiresMfa: true, authMethod },
      });
      return {
        accessToken: null,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        refreshToken: null,
        requiresMfa: true,
        mfaChallengeToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
        tenantId,
        sessionId: null,
      };
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
        metadata: { reason: 'session_create_failed', authMethod },
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
      metadata: { authMethod },
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

  /**
   * POST /auth/mfa/verify — complete login after TOTP challenge (MFA-004).
   */
  async verifyMfa(command: {
    readonly mfaChallengeToken: unknown;
    readonly code: unknown;
    readonly correlationId: string;
    readonly ip?: string;
    readonly userAgent?: string;
  }): Promise<LoginResult> {
    if (!this.sessions.isAvailable()) {
      throw new AppError('INTERNAL_ERROR', 'Authentication service is unavailable.', 503);
    }

    const verified = await this.mfa.verifyLoginChallenge({
      mfaChallengeToken: command.mfaChallengeToken,
      code: command.code,
    });

    const profile = await this.sessions.getUserProfile(verified.userId);
    if (profile === null || profile.status !== 'active') {
      throw new AppError('MFA_INVALID', 'Invalid MFA challenge.');
    }

    const accessToken = generateOpaqueToken(ACCESS_TOKEN_PREFIX);
    const refreshToken = generateOpaqueToken(REFRESH_TOKEN_PREFIX);
    const sessionId = randomUUID();
    const now = new Date();

    try {
      await this.sessions.createSession({
        id: sessionId,
        userId: verified.userId,
        tenantId: verified.tenantId,
        sessionTokenHash: hashToken(accessToken),
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: accessExpiresAt(now),
        refreshExpiresAt: refreshExpiresAt(now),
        ...(command.ip !== undefined ? { ip: command.ip } : {}),
        ...(command.userAgent !== undefined ? { userAgent: command.userAgent } : {}),
      });
    } catch {
      throw new AppError('INTERNAL_ERROR', 'Failed to create session after MFA.');
    }

    await this.safeAudit({
      action: 'auth.mfa.verify',
      outcome: 'success',
      correlationId: command.correlationId,
      actorUserId: verified.userId,
      tenantId: verified.tenantId,
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
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
      },
      tenantId: verified.tenantId,
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
    const activeTenantId = input.tenantId ?? null;

    // roles[] and permissions[] share one membership gate so they cannot diverge
    // after revoke (permissions already went through MembershipAwarePermissionSource;
    // roles used to bypass that and could still list assignments).
    let roles: MeResult['roles'] = [];
    let permissions: ReadonlyArray<string> = [];

    if (activeTenantId !== null && isUuid(activeTenantId)) {
      const membershipActive = await this.sessions.hasActiveMembership(
        input.userId,
        activeTenantId,
      );
      if (membershipActive) {
        roles = await this.rbacRead.listRolesForUser(input.userId, activeTenantId);
        if (this.permissionSource !== null) {
          const set = await this.permissionSource.getPermissions(input.userId, activeTenantId);
          permissions = [...set].sort();
        }
      }
    }

    const mfaActive = this.mfaRepo.isAvailable()
      ? await this.mfaRepo.hasActiveTotp(input.userId)
      : false;
    let privileged = false;
    if (activeTenantId !== null && isUuid(activeTenantId) && this.mfaRepo.isAvailable()) {
      privileged = await this.mfaRepo.isPrivileged(input.userId, activeTenantId);
    }
    const mfaEnrollmentRequired = privileged && !mfaActive;

    return {
      user: {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        status: profile.status,
      },
      memberships,
      activeTenantId,
      sessionId: input.sessionId ?? null,
      roles,
      permissions,
      mfaEnrollmentRequired,
      mfaEnforced: resolveMfaEnforceMode(),
      mfaActive,
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

function hasIdpAssertion(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}
