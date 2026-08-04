import type { CanActivate, ExecutionContext, Type } from '@nestjs/common';
import { Inject, Injectable, mixin, Optional } from '@nestjs/common';
import type { Request } from 'express';

import { AppError } from '../errors/app-error.js';
import { AUTH_CONTEXT_REQUEST_KEY } from '../auth/auth.constants.js';
import type { AuthContext } from '../auth/auth-context.js';
import { assertSessionTenantMatchesHeader } from '../auth/session-tenant-bind.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../tenant/tenant.constants.js';
import type { TenantContext } from '../tenant/tenant-context.js';
import type { PermissionCode } from './permission-codes.js';
import { PolicyEvaluator } from './policy-evaluator.js';
import {
  NoopPrivilegedMfaGate,
  PRIVILEGED_MFA_GATE,
  type PrivilegedMfaGate,
} from './privileged-mfa-gate.js';

type PlatformRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
};

/**
 * Factory guard: RequirePermission('tenant.read').
 * Requires auth + tenant header + session↔header bind, then policy evaluator
 * against the session-bound tenant. Under MFA_ENFORCE=hard, privileged routes
 * also require an active TOTP (continuous gate).
 */
export function RequirePermission(
  ...permissions: ReadonlyArray<PermissionCode>
): Type<CanActivate> {
  @Injectable()
  class RequirePermissionGuardMixin implements CanActivate {
    constructor(
      @Inject(PolicyEvaluator) private readonly evaluator: PolicyEvaluator,
      @Optional()
      @Inject(PRIVILEGED_MFA_GATE)
      private readonly privilegedMfaGate: PrivilegedMfaGate | null,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest<PlatformRequest>();
      const auth = request[AUTH_CONTEXT_REQUEST_KEY];
      const tenant = request[TENANT_CONTEXT_REQUEST_KEY];

      if (auth === undefined) {
        throw AppError.unauthorized();
      }
      if (tenant === undefined) {
        throw AppError.tenantContextRequired();
      }
      if (permissions.length === 0) {
        throw AppError.forbidden('No permissions configured for this route.');
      }

      const boundTenantId = assertSessionTenantMatchesHeader(auth, tenant);
      await this.evaluator.requireAny(auth.userId, boundTenantId, permissions);
      const gate = this.privilegedMfaGate ?? new NoopPrivilegedMfaGate();
      await gate.assertAccess(auth.userId, boundTenantId, permissions);
      return true;
    }
  }

  return mixin(RequirePermissionGuardMixin);
}
