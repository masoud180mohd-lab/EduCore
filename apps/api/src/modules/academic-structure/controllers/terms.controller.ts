import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/index.js';
import type { AuthContext } from '../../../common/auth/auth-context.js';
import { AppError } from '../../../common/errors/app-error.js';
import { RequirePermission } from '../../../common/policy/index.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import type { TenantContext } from '../../../common/tenant/tenant-context.js';
import { TermsService } from '../application/terms.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
};

/**
 * Product terms surface (Academic Structure — ACF-004).
 *
 * GET /api/v1/terms — list (academic.read) — IMP-003-P3
 * No POST/PATCH/DELETE; no get-by-id in this slice.
 *
 * List query: limit, cursor, academicYearId, status, search.
 * List response: { data, page: { nextCursor, limit } }.
 */
@Controller('api/v1/terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Get()
  @UseGuards(RequirePermission('academic.read'))
  async list(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw AppError.unauthorized();
    }
    if (tenant === undefined) {
      throw AppError.tenantContextRequired();
    }

    // RequirePermission already enforced session↔header bind + academic.read.
    return this.termsService.listForTenant(auth.userId, tenant.tenantId, {
      limit,
      cursor,
      academicYearId,
      status,
      search,
    });
  }
}
