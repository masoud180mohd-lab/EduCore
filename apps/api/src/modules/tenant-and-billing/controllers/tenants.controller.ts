import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AUTH_CONTEXT_REQUEST_KEY, RequireAuthGuard } from '../../../common/auth/index.js';
import type { AuthContext } from '../../../common/auth/auth-context.js';
import { AppError } from '../../../common/errors/app-error.js';
import { RequirePermission } from '../../../common/policy/index.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import type { TenantContext } from '../../../common/tenant/tenant-context.js';
import { TenantsService } from '../application/tenants.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
};

/**
 * Product tenants surface (solo operator / product read increments).
 *
 * GET  /api/v1/tenants         — list (auth + membership/RLS; picker UX, unpaginated, soft cap).
 * GET  /api/v1/tenants/current — current tenant (auth + X-Tenant-Id + session bind + tenant.read).
 * GET  /api/v1/tenants/:id     — detail (auth + X-Tenant-Id + session bind + tenant.read).
 * No POST/PATCH/DELETE (create/update/delete remain closed).
 *
 * Note: `current` is registered before `:id` so it is not captured as a path id.
 */
@Controller('api/v1/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @UseGuards(RequireAuthGuard)
  async list(@Req() request: AuthedRequest): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw AppError.unauthorized();
    }
    return this.tenantsService.listForUser(auth.userId);
  }

  @Get('current')
  @UseGuards(RequirePermission('tenant.read'))
  async getCurrent(@Req() request: AuthedRequest): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw AppError.unauthorized();
    }
    if (tenant === undefined) {
      throw AppError.tenantContextRequired();
    }

    // RequirePermission already enforced session↔header bind + tenant.read (membership-aware).
    // Load profile for the bound request tenant only.
    return this.tenantsService.getForUser(auth.userId, tenant.tenantId);
  }

  @Get(':id')
  @UseGuards(RequirePermission('tenant.read'))
  async getById(@Req() request: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw AppError.unauthorized();
    }
    if (tenant === undefined) {
      throw AppError.tenantContextRequired();
    }

    // ACF-aligned: path tenant must be the bound request tenant (no cross-tenant fetch via header spoof).
    if (id.trim().toLowerCase() !== tenant.tenantId.trim().toLowerCase()) {
      throw AppError.forbidden('Path tenant id must match X-Tenant-Id.', {
        reason: 'TENANT_PATH_MISMATCH',
      });
    }

    return this.tenantsService.getForUser(auth.userId, id);
  }
}
