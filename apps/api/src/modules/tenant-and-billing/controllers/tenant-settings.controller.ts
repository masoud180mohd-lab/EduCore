import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/index.js';
import type { AuthContext } from '../../../common/auth/auth-context.js';
import { AppError } from '../../../common/errors/app-error.js';
import { RequirePermission } from '../../../common/policy/index.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import type { TenantContext } from '../../../common/tenant/tenant-context.js';
import { TenantSettingsService } from '../application/tenant-settings.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
};

/**
 * Product tenant-settings surface (solo operator / product read increments).
 *
 * GET  /api/v1/tenant-settings — read settings document (auth + X-Tenant-Id + session bind + tenant.read).
 * No PUT/PATCH/DELETE (settings write remains closed).
 */
@Controller('api/v1/tenant-settings')
export class TenantSettingsController {
  constructor(private readonly tenantSettingsService: TenantSettingsService) {}

  @Get()
  @UseGuards(RequirePermission('tenant.read'))
  async get(@Req() request: AuthedRequest): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw AppError.unauthorized();
    }
    if (tenant === undefined) {
      throw AppError.tenantContextRequired();
    }

    // RequirePermission already enforced session↔header bind + tenant.read.
    return this.tenantSettingsService.getForTenant(auth.userId, tenant.tenantId);
  }
}
