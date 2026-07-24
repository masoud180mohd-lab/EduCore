import {
  Body,
  Controller,
  Delete,
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
import { SubjectsService } from '../application/subjects.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

/**
 * Subjects surface (ACF-007 rev 1.2).
 * GET list/detail academic.read; POST/PATCH (IMP-013) academic.manage;
 * DELETE when empty (academic.manage) — IMP-014.
 */
@Controller('api/v1/subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  @UseGuards(RequirePermission('academic.read'))
  async list(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) throw AppError.unauthorized();
    if (tenant === undefined) throw AppError.tenantContextRequired();
    return this.subjectsService.listForTenant(auth.userId, tenant.tenantId, {
      limit,
      cursor,
      status,
      search,
    });
  }

  @Post()
  @HttpCode(201)
  @UseGuards(RequirePermission('academic.manage'))
  async create(
    @Req() request: AuthedRequest,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) throw AppError.unauthorized();
    if (tenant === undefined) throw AppError.tenantContextRequired();
    const correlationId =
      request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';
    return this.subjectsService.createForTenant(
      auth.userId,
      tenant.tenantId,
      body,
      idempotencyKey,
      correlationId,
    );
  }

  @Get(':id')
  @UseGuards(RequirePermission('academic.read'))
  async getById(@Req() request: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) throw AppError.unauthorized();
    if (tenant === undefined) throw AppError.tenantContextRequired();
    return this.subjectsService.getForTenant(auth.userId, tenant.tenantId, id);
  }

  @Patch(':id')
  @UseGuards(RequirePermission('academic.manage'))
  async patch(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) throw AppError.unauthorized();
    if (tenant === undefined) throw AppError.tenantContextRequired();
    const correlationId =
      request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';
    return this.subjectsService.patchForTenant(
      auth.userId,
      tenant.tenantId,
      id,
      body,
      idempotencyKey,
      correlationId,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(RequirePermission('academic.manage'))
  async remove(@Req() request: AuthedRequest, @Param('id') id: string): Promise<void> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) throw AppError.unauthorized();
    if (tenant === undefined) throw AppError.tenantContextRequired();
    const correlationId =
      request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';
    await this.subjectsService.deleteForTenant(auth.userId, tenant.tenantId, id, correlationId);
  }
}
