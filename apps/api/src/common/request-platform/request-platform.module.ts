import { Global, Module } from '@nestjs/common';
import type { Pool } from 'pg';

import {
  DevStubTokenValidator,
  RejectAllTokenValidator,
  RequireActiveMembershipGuard,
  RequireAuthGuard,
  RequireTenantContextGuard,
  TOKEN_VALIDATOR,
} from '../auth/index.js';
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

/**
 * Global request-platform providers (auth, tenant membership, policy).
 * Middleware is registered on AppModule; guards/evaluator inject from here.
 *
 * Defaults:
 * - RejectAllTokenValidator (fail-closed tokens until AuthN lands)
 * - PgTenantMembershipChecker when app DB pool enabled, else DenyAll
 * - MembershipAwarePermissionSource → PgPermissionSource (or Empty without pool)
 *
 * Tests may override TOKEN_VALIDATOR / TENANT_MEMBERSHIP_CHECKER / PERMISSION_SOURCE.
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: TOKEN_VALIDATOR,
      useClass: RejectAllTokenValidator,
    },
    {
      provide: TENANT_MEMBERSHIP_CHECKER,
      inject: [PG_POOL],
      useFactory: (pool: Pool | null): TenantMembershipChecker => {
        if (pool !== null) {
          return new PgTenantMembershipChecker(pool);
        }
        return new DenyAllTenantMembershipChecker();
      },
    },
    {
      provide: MembershipAwarePermissionSource.INNER,
      inject: [PG_POOL],
      useFactory: (pool: Pool | null): PermissionSource => {
        if (pool !== null) {
          return new PgPermissionSource(pool);
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
    // Available for test modules that opt in; not wired as default TOKEN_VALIDATOR.
    DevStubTokenValidator,
  ],
  exports: [
    TOKEN_VALIDATOR,
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
