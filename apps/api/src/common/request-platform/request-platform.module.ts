import { Global, Module } from '@nestjs/common';
import type { Pool } from 'pg';

import {
  DevStubTokenValidator,
  RequireActiveMembershipGuard,
  RequireAuthGuard,
  RequireTenantContextGuard,
} from '../auth/index.js';
import type { AppLogger } from '../logging/logger.js';
import { APP_LOGGER } from '../logging/logger.tokens.js';
import { DatabaseModule, PG_POOL } from '../persistence/index.js';
import {
  EmptyPermissionSource,
  MembershipAwarePermissionSource,
  PERMISSION_SOURCE,
  PgPermissionSource,
  PolicyEvaluator,
} from '../policy/index.js';
import type { PermissionSource } from '../policy/policy-evaluator.js';
import {
  DenyAllTenantMembershipChecker,
  PgTenantMembershipChecker,
  TENANT_MEMBERSHIP_CHECKER,
} from '../tenant/index.js';
import type { TenantMembershipChecker } from '../tenant/tenant-membership.checker.js';
import { IDEMPOTENCY_STORE, InMemoryIdempotencyStore } from '../idempotency/index.js';

/**
 * Global request-platform providers (tenant membership, policy, guards).
 * TOKEN_VALIDATOR is composed in AppModule (SessionTokenValidator vs RejectAll)
 * so common does not depend on Identity session repository (PLAT-005).
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: IDEMPOTENCY_STORE,
      useClass: InMemoryIdempotencyStore,
    },
    {
      provide: TENANT_MEMBERSHIP_CHECKER,
      inject: [PG_POOL, APP_LOGGER],
      useFactory: (pool: Pool | null, logger: AppLogger): TenantMembershipChecker => {
        if (pool !== null) {
          return new PgTenantMembershipChecker(pool, logger);
        }
        return new DenyAllTenantMembershipChecker();
      },
    },
    {
      provide: MembershipAwarePermissionSource.INNER,
      inject: [PG_POOL, APP_LOGGER],
      useFactory: (pool: Pool | null, logger: AppLogger): PermissionSource => {
        if (pool !== null) {
          return new PgPermissionSource(pool, logger);
        }
        return new EmptyPermissionSource();
      },
    },
    {
      provide: PERMISSION_SOURCE,
      useClass: MembershipAwarePermissionSource,
    },
    PolicyEvaluator,
    RequireAuthGuard,
    RequireTenantContextGuard,
    RequireActiveMembershipGuard,
    DevStubTokenValidator,
  ],
  exports: [
    IDEMPOTENCY_STORE,
    TENANT_MEMBERSHIP_CHECKER,
    PERMISSION_SOURCE,
    PolicyEvaluator,
    RequireAuthGuard,
    RequireTenantContextGuard,
    RequireActiveMembershipGuard,
    DevStubTokenValidator,
  ],
})
export class RequestPlatformModule {}
