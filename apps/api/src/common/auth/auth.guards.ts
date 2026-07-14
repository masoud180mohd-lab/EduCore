import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { AppError } from '../errors/app-error.js';
import { TENANT_CONTEXT_REQUEST_KEY, TENANT_MEMBERSHIP_CHECKER } from '../tenant/index.js';
import type { TenantContext } from '../tenant/tenant-context.js';
import type { TenantMembershipChecker } from '../tenant/tenant-membership.checker.js';
import { AUTH_CONTEXT_REQUEST_KEY } from './auth.constants.js';
import type { AuthContext } from './auth-context.js';

type PlatformRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
};

@Injectable()
export class RequireAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PlatformRequest>();
    if (request[AUTH_CONTEXT_REQUEST_KEY] === undefined) {
      throw AppError.unauthorized();
    }
    return true;
  }
}

@Injectable()
export class RequireTenantContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PlatformRequest>();
    if (request[TENANT_CONTEXT_REQUEST_KEY] === undefined) {
      throw AppError.tenantContextRequired();
    }
    return true;
  }
}

/**
 * Requires authenticated user + tenant header + active membership (tenant_memberships).
 */
@Injectable()
export class RequireActiveMembershipGuard implements CanActivate {
  constructor(
    @Inject(TENANT_MEMBERSHIP_CHECKER)
    private readonly membershipChecker: TenantMembershipChecker,
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

    const ok = await this.membershipChecker.hasActiveMembership(auth.userId, tenant.tenantId);
    if (!ok) {
      throw AppError.tenantMembershipRequired();
    }
    return true;
  }
}
