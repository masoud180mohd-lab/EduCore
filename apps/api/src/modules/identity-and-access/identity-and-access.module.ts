import { Global, Module } from '@nestjs/common';
import type { Pool } from 'pg';

import {
  hashToken,
  RejectAllTokenValidator,
  SessionTokenValidator,
  TOKEN_VALIDATOR,
} from '../../common/auth/index.js';
import type { TokenValidator } from '../../common/auth/token-validator.js';
import { DatabaseModule, PG_POOL } from '../../common/persistence/index.js';
import { PRIVILEGED_MFA_GATE } from '../../common/policy/index.js';
import { PlatformOperationsModule } from '../platform-operations/index.js';
import { IdentityAndAccessApplicationService } from './application/identity-and-access.application-service.js';
import { MembershipsService } from './application/memberships.service.js';
import { PermissionsService } from './application/permissions.service.js';
import { RolesService } from './application/roles.service.js';
import { UserRolesService } from './application/user-roles.service.js';
import { UsersService } from './application/users.service.js';
import { AuthService } from './auth/auth.service.js';
import { HardPrivilegedMfaGate } from './auth/hard-privileged-mfa.gate.js';
import {
  createLoginRateLimiter,
  LOGIN_RATE_LIMITER,
  type LoginRateLimiter,
} from './auth/login-rate-limiter.js';
import { AuthController } from './controllers/auth.controller.js';
import { IdentityAndAccessController } from './controllers/identity-and-access.controller.js';
import { MembershipsController } from './controllers/memberships.controller.js';
import { MfaFactorsController } from './controllers/mfa-factors.controller.js';
import { PermissionsController } from './controllers/permissions.controller.js';
import { RolesController } from './controllers/roles.controller.js';
import { UserRolesController } from './controllers/user-roles.controller.js';
import { UsersController } from './controllers/users.controller.js';
import { IdentityAndAccessDomainService } from './domain/identity-and-access.domain-service.js';
import { IdentityAndAccessPolicy } from './policies/identity-and-access.policy.js';
import { MfaService } from './application/mfa.service.js';
import { IDENTITY_AND_ACCESS_REPOSITORY } from './repositories/identity-and-access.repository.js';
import { IdentityAndAccessRepositoryPlaceholder } from './repositories/identity-and-access.repository.placeholder.js';
import { MembershipsRepository } from './repositories/memberships.repository.js';
import { MfaRepository } from './repositories/mfa.repository.js';
import { PermissionsRepository } from './repositories/permissions.repository.js';
import { RolesRepository } from './repositories/roles.repository.js';
import { UserRolesRepository } from './repositories/user-roles.repository.js';
import { UsersRepository } from './repositories/users.repository.js';
import { RbacReadRepository } from './rbac/rbac-read.repository.js';
import { SessionRepository } from './repositories/session.repository.js';

/**
 * Bounded context: Identity And Access.
 * P3 AuthN + P4 RBAC + membership/users reads + gated P15 invite + P17 user patch.
 * Role-admin reads and writes shipped (IMP-022). Membership lifecycle shipped (IMP-020).
 * User disable (IMP-016) + enable (IMP-021) shipped.
 */
@Global()
@Module({
  imports: [DatabaseModule, PlatformOperationsModule],
  controllers: [
    IdentityAndAccessController,
    AuthController,
    MfaFactorsController,
    MembershipsController,
    PermissionsController,
    RolesController,
    UserRolesController,
    UsersController,
  ],
  providers: [
    IdentityAndAccessApplicationService,
    IdentityAndAccessDomainService,
    IdentityAndAccessPolicy,
    {
      provide: IDENTITY_AND_ACCESS_REPOSITORY,
      useClass: IdentityAndAccessRepositoryPlaceholder,
    },
    SessionRepository,
    MfaRepository,
    MfaService,
    {
      provide: PRIVILEGED_MFA_GATE,
      useClass: HardPrivilegedMfaGate,
    },
    RbacReadRepository,
    MembershipsRepository,
    MembershipsService,
    PermissionsRepository,
    PermissionsService,
    RolesRepository,
    RolesService,
    UserRolesRepository,
    UserRolesService,
    UsersRepository,
    UsersService,
    AuthService,
    {
      provide: LOGIN_RATE_LIMITER,
      inject: [PG_POOL],
      useFactory: async (pool: Pool | null): Promise<LoginRateLimiter> =>
        createLoginRateLimiter({ pool }),
    },
    {
      provide: TOKEN_VALIDATOR,
      inject: [SessionRepository],
      useFactory: (sessions: SessionRepository): TokenValidator => {
        if (!sessions.isAvailable()) {
          return new RejectAllTokenValidator();
        }
        return new SessionTokenValidator(sessions, hashToken);
      },
    },
  ],
  exports: [
    IdentityAndAccessApplicationService,
    IDENTITY_AND_ACCESS_REPOSITORY,
    AuthService,
    TOKEN_VALIDATOR,
    PRIVILEGED_MFA_GATE,
    RbacReadRepository,
    MembershipsService,
    PermissionsService,
    RolesService,
    UserRolesService,
    UsersService,
  ],
})
export class IdentityAndAccessModule {}
