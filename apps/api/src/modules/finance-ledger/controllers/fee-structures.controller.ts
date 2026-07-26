import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/index.js';
import type { AuthContext } from '../../../common/auth/auth-context.js';
import {
  CORRELATION_ID_REQUEST_KEY,
  REQUEST_ID_REQUEST_KEY,
} from '../../../common/correlation/correlation.constants.js';
import { AppError } from '../../../common/errors/app-error.js';
import { IDEMPOTENCY_KEY_HEADER } from '../../../common/idempotency/index.js';
import { RequirePermission } from '../../../common/policy/index.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import type { TenantContext } from '../../../common/tenant/tenant-context.js';
import { FeeStructuresService } from '../application/fee-structures.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

/**
 * Fee structures product surface (IMP-009 / ACF-012).
 *
 * GET  /api/v1/fee-structures       — list (finance.read)
 * POST /api/v1/fee-structures       — create (finance.manage + Idempotency-Key)
 * GET  /api/v1/fee-structures/:id   — detail with items (finance.read)
 * PATCH /api/v1/fee-structures/:id  — partial update (finance.manage)
 */
@Controller()
export class FeeStructuresController {
  constructor(private readonly feeStructuresService: FeeStructuresService) {}

  @Get('api/v1/fee-structures')
  @UseGuards(RequirePermission('finance.read'))
  async listFeeStructures(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('status') status?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.feeStructuresService.listForTenant(auth.userId, tenant.tenantId, {
      limit,
      cursor,
      academicYearId,
      status,
    });
  }

  @Post('api/v1/fee-structures')
  @HttpCode(201)
  @UseGuards(RequirePermission('finance.manage'))
  async createFeeStructure(
    @Req() request: AuthedRequest,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.feeStructuresService.createForTenant(
      auth.userId,
      tenant.tenantId,
      body,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Get('api/v1/fee-structures/:feeStructureId')
  @UseGuards(RequirePermission('finance.read'))
  async getFeeStructure(
    @Req() request: AuthedRequest,
    @Param('feeStructureId') feeStructureId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.feeStructuresService.getForTenant(auth.userId, tenant.tenantId, feeStructureId);
  }

  @Patch('api/v1/fee-structures/:feeStructureId')
  @UseGuards(RequirePermission('finance.manage'))
  async patchFeeStructure(
    @Req() request: AuthedRequest,
    @Param('feeStructureId') feeStructureId: string,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.feeStructuresService.patchForTenant(
      auth.userId,
      tenant.tenantId,
      feeStructureId,
      body,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }
}

function requireAuthTenant(request: AuthedRequest): {
  readonly auth: AuthContext;
  readonly tenant: TenantContext;
} {
  const auth = request[AUTH_CONTEXT_REQUEST_KEY];
  const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
  if (auth === undefined) throw AppError.unauthorized();
  if (tenant === undefined) throw AppError.tenantContextRequired();
  return { auth, tenant };
}

function resolveCorrelationId(request: AuthedRequest): string {
  return request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';
}
