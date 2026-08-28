import type { CanActivate, ExecutionContext, Type } from '@nestjs/common';
import { Inject, Injectable, mixin, Optional } from '@nestjs/common';
import type { Request } from 'express';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import type { AuthContext } from '../../../common/auth/auth-context.js';
import { AppError } from '../../../common/errors/app-error.js';
import {
  NoopPrivilegedMfaGate,
  PRIVILEGED_MFA_GATE,
  type PrivilegedMfaGate,
} from '../../../common/policy/privileged-mfa-gate.js';
import { TENANT_ID_HEADER } from '../../../common/tenant/tenant.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import type { TenantContext } from '../../../common/tenant/tenant-context.js';
import { PlatformTenantsRepository } from '../repositories/platform-tenants.repository.js';

type PlatformRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
};

const PLATFORM_MFA_SENTINEL = 'tenant.manage';
const PLATFORM_MFA_TENANT = '00000000-0000-4000-8000-000000000000';

/**
 * ACF-PLAT-001: authenticated platform super_admin, no X-Tenant-Id.
 * Write routes also require the privileged MFA gate (hard when MFA_ENFORCE=hard).
 */
export function RequirePlatformOperator(
  options: { readonly write?: boolean } = {},
): Type<CanActivate> {
  @Injectable()
  class RequirePlatformOperatorGuardMixin implements CanActivate {
    constructor(
      private readonly operators: PlatformTenantsRepository,
      @Optional()
      @Inject(PRIVILEGED_MFA_GATE)
      private readonly privilegedMfaGate: PrivilegedMfaGate | null,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest<PlatformRequest>();
      const auth = request[AUTH_CONTEXT_REQUEST_KEY];
      if (auth === undefined) {
        throw AppError.unauthorized();
      }

      const header = request.header(TENANT_ID_HEADER);
      if (
        (header !== undefined && header.trim() !== '') ||
        request[TENANT_CONTEXT_REQUEST_KEY] !== undefined
      ) {
        throw AppError.validation('Platform routes must not send X-Tenant-Id.');
      }

      const isOperator = await this.operators.isActiveSuperAdmin(auth.userId);
      if (!isOperator) {
        throw AppError.forbidden('You do not have platform access.');
      }

      if (options.write === true) {
        const gate = this.privilegedMfaGate ?? new NoopPrivilegedMfaGate();
        await gate.assertAccess(auth.userId, PLATFORM_MFA_TENANT, [PLATFORM_MFA_SENTINEL]);
      }

      return true;
    }
  }

  return mixin(RequirePlatformOperatorGuardMixin);
}
