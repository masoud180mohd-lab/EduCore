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
import { PlatformOperationsModule } from '../platform-operations/index.js';
import { IdentityAndAccessApplicationService } from './application/identity-and-access.application-service.js';
import { MembershipsService } from './application/memberships.service.js';
import { UsersService } from './application/users.service.js';
import { AuthService } from './auth/auth.service.js';
import {
  createLoginRateLimiter,
  LOGIN_RATE_LIMITER,
  type LoginRateLimiter,
} from './auth/login-rate-limiter.js';
import { AuthController } from './controllers/auth.controller.js';
import { IdentityAndAccessController } from './controllers/identity-and-access.controller.js';
import { MembershipsController } from './controllers/memberships.controller.js';
import { UsersController } from './controllers/users.controller.js';
import { IdentityAndAccessDomainService } from './domain/identity-and-access.domain-service.js';
import { IdentityAndAccessPolicy } from './policies/identity-and-access.policy.js';
import { IDENTITY_AND_ACCESS_REPOSITORY } from './repositories/identity-and-access.repository.js';
import { IdentityAndAccessRepositoryPlaceholder } from './repositories/identity-and-access.repository.placeholder.js';
import { MembershipsRepository } from './repositories/memberships.repository.js';
import { UsersRepository } from './repositories/users.repository.js';
import { RbacReadRepository } from './rbac/rbac-read.repository.js';
import { SessionRepository } from './repositories/session.repository.js';

/**
 * Bounded context: Identity And Access.
 * P3 AuthN + P4 RBAC + membership/users reads + gated P15 invite + P17 user patch.
 * Role-admin / membership suspend/remove remain closed. User disable shipped (IMP-016).
 */
@Global()
@Module({
  imports: [DatabaseModule, PlatformOperationsModule],
  controllers: [
    IdentityAndAccessController,
    AuthController,
    MembershipsController,
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
    RbacReadRepository,
    MembershipsRepository,
    MembershipsService,
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
    RbacReadRepository,
    MembershipsService,
    UsersService,
  ],
})
export class IdentityAndAccessModule {}
