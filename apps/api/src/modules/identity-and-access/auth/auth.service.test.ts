import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../common/errors/app-error.js';
import { AuthService } from './auth.service.js';
import { InMemoryLoginRateLimiter } from './login-rate-limiter.js';
import { hashPassword } from './password-hasher.js';

const stubRbac = { listRolesForUser: vi.fn().mockResolvedValue([]) };
const stubMfa = {
  createLoginChallenge: vi.fn().mockResolvedValue('ecm_challenge'),
  verifyLoginChallenge: vi.fn(),
  enforceMode: () => 'soft' as const,
};
const stubMfaRepo = {
  isAvailable: () => false,
  hasActiveTotp: vi.fn().mockResolvedValue(false),
  isPrivileged: vi.fn().mockResolvedValue(false),
};

function createAuth(
  sessions: unknown,
  audit: unknown = null,
  rbac: unknown = stubRbac,
  permissionSource: unknown = null,
  mfa: unknown = stubMfa,
  mfaRepo: unknown = stubMfaRepo,
): AuthService {
  return new AuthService(
    sessions as never,
    new InMemoryLoginRateLimiter(),
    audit as never,
    rbac as never,
    permissionSource as never,
    mfa as never,
    mfaRepo as never,
  );
}

describe('AuthService login', () => {
  it('rejects when session store is unavailable', async () => {
    const sessions = { isAvailable: () => false };
    const service = createAuth(sessions);
    await expect(
      service.login({
        email: 'a@example.com',
        password: 'password12',
        correlationId: 'c1',
      }),
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  it('returns INVALID_CREDENTIALS for unknown user (no enumeration)', async () => {
    const sessions = {
      isAvailable: () => true,
      lookupUserByEmail: vi.fn().mockResolvedValue(null),
    };
    const service = createAuth(sessions);
    await expect(
      service.login({
        email: 'missing@example.com',
        password: 'password12',
        correlationId: 'c1',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('issues tokens when password and membership are valid', async () => {
    const passwordHash = await hashPassword('password12');
    const sessions = {
      isAvailable: () => true,
      lookupUserByEmail: vi.fn().mockResolvedValue({
        id: '01900000-0000-7000-8000-000000000001',
        email: 'user@example.com',
        displayName: 'User',
        status: 'active',
        passwordHash,
      }),
      hasActiveMembership: vi.fn().mockResolvedValue(true),
      listActiveMembershipTenants: vi.fn(),
      createSession: vi.fn().mockResolvedValue('sess-id'),
    };
    const audit = { publish: vi.fn().mockResolvedValue(undefined) };
    const service = createAuth(sessions, audit);

    const result = await service.login({
      email: 'user@example.com',
      password: 'password12',
      tenantId: '01900000-0000-7000-8000-0000000000aa',
      correlationId: 'c1',
    });

    expect(result.accessToken?.startsWith('ecs_')).toBe(true);
    expect(result.refreshToken?.startsWith('ecr_')).toBe(true);
    expect(result.requiresMfa).toBe(false);
    expect(result.user.email).toBe('user@example.com');
    expect(sessions.createSession).toHaveBeenCalledOnce();
    expect(audit.publish).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login', outcome: 'success' }),
    );
  });

  it('returns MFA challenge when active TOTP exists', async () => {
    const passwordHash = await hashPassword('password12');
    const sessions = {
      isAvailable: () => true,
      lookupUserByEmail: vi.fn().mockResolvedValue({
        id: '01900000-0000-7000-8000-000000000001',
        email: 'user@example.com',
        displayName: 'User',
        status: 'active',
        passwordHash,
      }),
      hasActiveMembership: vi.fn().mockResolvedValue(true),
      createSession: vi.fn(),
    };
    const mfa = {
      createLoginChallenge: vi.fn().mockResolvedValue('ecm_tok'),
    };
    const mfaRepo = {
      isAvailable: () => true,
      hasActiveTotp: vi.fn().mockResolvedValue(true),
      isPrivileged: vi.fn().mockResolvedValue(true),
    };
    const service = createAuth(sessions, null, stubRbac, null, mfa, mfaRepo);
    const result = await service.login({
      email: 'user@example.com',
      password: 'password12',
      tenantId: '01900000-0000-7000-8000-0000000000aa',
      correlationId: 'c1',
    });
    expect(result.requiresMfa).toBe(true);
    expect(result.mfaChallengeToken).toBe('ecm_tok');
    expect(result.accessToken).toBeNull();
    expect(sessions.createSession).not.toHaveBeenCalled();
  });

  it('hard enforce denies privileged login without TOTP', async () => {
    const passwordHash = await hashPassword('password12');
    const sessions = {
      isAvailable: () => true,
      lookupUserByEmail: vi.fn().mockResolvedValue({
        id: '01900000-0000-7000-8000-000000000001',
        email: 'user@example.com',
        displayName: 'User',
        status: 'active',
        passwordHash,
      }),
      hasActiveMembership: vi.fn().mockResolvedValue(true),
      createSession: vi.fn(),
    };
    const mfaRepo = {
      isAvailable: () => true,
      hasActiveTotp: vi.fn().mockResolvedValue(false),
      isPrivileged: vi.fn().mockResolvedValue(true),
    };
    const prev = process.env['MFA_ENFORCE'];
    process.env['MFA_ENFORCE'] = 'hard';
    const service = createAuth(sessions, null, stubRbac, null, stubMfa, mfaRepo);
    await expect(
      service.login({
        email: 'user@example.com',
        password: 'password12',
        tenantId: '01900000-0000-7000-8000-0000000000aa',
        correlationId: 'c1',
      }),
    ).rejects.toMatchObject({ code: 'MFA_REQUIRED', statusCode: 403 });
    expect(sessions.createSession).not.toHaveBeenCalled();
    if (prev === undefined) delete process.env['MFA_ENFORCE'];
    else process.env['MFA_ENFORCE'] = prev;
  });

  it('hard enforce fails closed when MFA store unavailable', async () => {
    const passwordHash = await hashPassword('password12');
    const sessions = {
      isAvailable: () => true,
      lookupUserByEmail: vi.fn().mockResolvedValue({
        id: '01900000-0000-7000-8000-000000000001',
        email: 'user@example.com',
        displayName: 'User',
        status: 'active',
        passwordHash,
      }),
      hasActiveMembership: vi.fn().mockResolvedValue(true),
      createSession: vi.fn(),
    };
    const mfaRepo = {
      isAvailable: () => false,
      hasActiveTotp: vi.fn(),
      isPrivileged: vi.fn(),
    };
    const prev = process.env['MFA_ENFORCE'];
    process.env['MFA_ENFORCE'] = 'hard';
    const service = createAuth(sessions, null, stubRbac, null, stubMfa, mfaRepo);
    await expect(
      service.login({
        email: 'user@example.com',
        password: 'password12',
        tenantId: '01900000-0000-7000-8000-0000000000aa',
        correlationId: 'c1',
      }),
    ).rejects.toMatchObject({ code: 'MFA_REQUIRED', statusCode: 403 });
    expect(sessions.createSession).not.toHaveBeenCalled();
    if (prev === undefined) delete process.env['MFA_ENFORCE'];
    else process.env['MFA_ENFORCE'] = prev;
  });

  it('rate-limits repeated failures', async () => {
    const limiter = new InMemoryLoginRateLimiter(2, 60_000);
    const sessions = {
      isAvailable: () => true,
      lookupUserByEmail: vi.fn().mockResolvedValue(null),
    };
    const service = new AuthService(
      sessions as never,
      limiter,
      null,
      stubRbac as never,
      null,
      stubMfa as never,
      stubMfaRepo as never,
    );
    const cmd = {
      email: 'a@example.com',
      password: 'password12',
      correlationId: 'c',
      ip: '1.2.3.4',
    };
    await expect(service.login(cmd)).rejects.toBeInstanceOf(AppError);
    await expect(service.login(cmd)).rejects.toBeInstanceOf(AppError);
    await expect(service.login(cmd)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('AuthService me + select-tenant', () => {
  const userId = '01900000-0000-7000-8000-000000000001';
  const tenantId = '01900000-0000-7000-8000-0000000000aa';
  const sessionId = '01900000-0000-7000-8000-000000000099';

  it('returns profile and memberships for me', async () => {
    const sessions = {
      isAvailable: () => true,
      getUserProfile: vi.fn().mockResolvedValue({
        id: userId,
        email: 'a@b.co',
        displayName: 'A',
        status: 'active',
      }),
      listMembershipSummaries: vi
        .fn()
        .mockResolvedValue([{ tenantId, status: 'active', joinedAt: '2026-01-01T00:00:00.000Z' }]),
      hasActiveMembership: vi.fn().mockResolvedValue(true),
    };
    const service = createAuth(sessions);
    const me = await service.me({ userId, sessionId, tenantId });
    expect(me.user.email).toBe('a@b.co');
    expect(me.activeTenantId).toBe(tenantId);
    expect(me.memberships).toHaveLength(1);
    expect(me.roles).toEqual([]);
    expect(me.permissions).toEqual([]);
    expect(me.mfaEnrollmentRequired).toBe(false);
    expect(me.mfaEnforced).toBe('soft');
    expect(me.mfaActive).toBe(false);
  });

  it('me returns roles and permissions only when membership is active', async () => {
    const sessions = {
      isAvailable: () => true,
      getUserProfile: vi.fn().mockResolvedValue({
        id: userId,
        email: 'a@b.co',
        displayName: 'A',
        status: 'active',
      }),
      listMembershipSummaries: vi
        .fn()
        .mockResolvedValue([{ tenantId, status: 'active', joinedAt: '2026-01-01T00:00:00.000Z' }]),
      hasActiveMembership: vi.fn().mockResolvedValue(true),
    };
    const rbacRead = {
      listRolesForUser: vi
        .fn()
        .mockResolvedValue([{ code: 'owner', name: 'Owner', isSystem: true }]),
    };
    const permissionSource = {
      getPermissions: vi.fn().mockResolvedValue(new Set(['tenant.read', 'role.read'])),
    };
    const service = createAuth(sessions, null, rbacRead, permissionSource);

    const me = await service.me({ userId, sessionId, tenantId });

    expect(sessions.hasActiveMembership).toHaveBeenCalledWith(userId, tenantId);
    expect(rbacRead.listRolesForUser).toHaveBeenCalledWith(userId, tenantId);
    expect(permissionSource.getPermissions).toHaveBeenCalledWith(userId, tenantId);
    expect(me.roles).toEqual([{ code: 'owner', name: 'Owner', isSystem: true }]);
    expect(me.permissions).toEqual(['role.read', 'tenant.read']);
  });

  it('me returns empty roles and permissions when membership is inactive (consistent)', async () => {
    const sessions = {
      isAvailable: () => true,
      getUserProfile: vi.fn().mockResolvedValue({
        id: userId,
        email: 'a@b.co',
        displayName: 'A',
        status: 'active',
      }),
      listMembershipSummaries: vi
        .fn()
        .mockResolvedValue([{ tenantId, status: 'revoked', joinedAt: '2026-01-01T00:00:00.000Z' }]),
      hasActiveMembership: vi.fn().mockResolvedValue(false),
    };
    const rbacRead = {
      listRolesForUser: vi
        .fn()
        .mockResolvedValue([{ code: 'owner', name: 'Owner', isSystem: true }]),
    };
    const permissionSource = {
      getPermissions: vi.fn().mockResolvedValue(new Set(['tenant.read'])),
    };
    const service = createAuth(sessions, null, rbacRead, permissionSource);

    const me = await service.me({ userId, sessionId, tenantId });

    expect(me.roles).toEqual([]);
    expect(me.permissions).toEqual([]);
    expect(rbacRead.listRolesForUser).not.toHaveBeenCalled();
    expect(permissionSource.getPermissions).not.toHaveBeenCalled();
  });

  it('me returns empty RBAC fields when activeTenantId is unbound', async () => {
    const sessions = {
      isAvailable: () => true,
      getUserProfile: vi.fn().mockResolvedValue({
        id: userId,
        email: 'a@b.co',
        displayName: 'A',
        status: 'active',
      }),
      listMembershipSummaries: vi.fn().mockResolvedValue([]),
      hasActiveMembership: vi.fn(),
    };
    const rbacRead = { listRolesForUser: vi.fn() };
    const permissionSource = { getPermissions: vi.fn() };
    const service = createAuth(sessions, null, rbacRead, permissionSource);

    const me = await service.me({ userId, sessionId });

    expect(me.activeTenantId).toBeNull();
    expect(me.roles).toEqual([]);
    expect(me.permissions).toEqual([]);
    expect(sessions.hasActiveMembership).not.toHaveBeenCalled();
    expect(rbacRead.listRolesForUser).not.toHaveBeenCalled();
    expect(permissionSource.getPermissions).not.toHaveBeenCalled();
  });

  it('me flags mfaEnrollmentRequired when privileged without TOTP', async () => {
    const sessions = {
      isAvailable: () => true,
      getUserProfile: vi.fn().mockResolvedValue({
        id: userId,
        email: 'a@b.co',
        displayName: 'A',
        status: 'active',
      }),
      listMembershipSummaries: vi.fn().mockResolvedValue([]),
      hasActiveMembership: vi.fn().mockResolvedValue(true),
    };
    const mfaRepo = {
      isAvailable: () => true,
      hasActiveTotp: vi.fn().mockResolvedValue(false),
      isPrivileged: vi.fn().mockResolvedValue(true),
    };
    const service = createAuth(sessions, null, stubRbac, null, stubMfa, mfaRepo);
    const me = await service.me({ userId, sessionId, tenantId });
    expect(me.mfaEnrollmentRequired).toBe(true);
    expect(me.mfaActive).toBe(false);
  });

  it('selectTenant rebinds when membership is active', async () => {
    const sessions = {
      isAvailable: () => true,
      hasActiveMembership: vi.fn().mockResolvedValue(true),
      rebindSessionTenant: vi.fn().mockResolvedValue(true),
    };
    const audit = { publish: vi.fn().mockResolvedValue(undefined) };
    const service = createAuth(sessions, audit);
    await expect(
      service.selectTenant({
        userId: '01900000-0000-7000-8000-000000000001',
        sessionId: '01900000-0000-7000-8000-000000000099',
        tenantId: '01900000-0000-7000-8000-0000000000aa',
        correlationId: 'c',
      }),
    ).resolves.toEqual({ tenantId: '01900000-0000-7000-8000-0000000000aa' });
    expect(sessions.rebindSessionTenant).toHaveBeenCalledOnce();
  });

  it('selectTenant denies without active membership', async () => {
    const sessions = {
      isAvailable: () => true,
      hasActiveMembership: vi.fn().mockResolvedValue(false),
    };
    const service = createAuth(sessions);
    await expect(
      service.selectTenant({
        userId: '01900000-0000-7000-8000-000000000001',
        sessionId: '01900000-0000-7000-8000-000000000099',
        tenantId: '01900000-0000-7000-8000-0000000000aa',
        correlationId: 'c',
      }),
    ).rejects.toMatchObject({ code: 'TENANT_MEMBERSHIP_REQUIRED' });
  });
});
