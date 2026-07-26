import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
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
import { RolesService } from '../application/roles.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

@Controller('api/v1/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @UseGuards(RequirePermission('role.read'))
  async list(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<unknown> {
    const { userId, tenantId } = context(request);
    return this.rolesService.listForTenant(userId, tenantId, { limit, cursor });
  }

  @Post()
  @HttpCode(201)
  @UseGuards(RequirePermission('role.manage'))
  async create(
    @Req() request: AuthedRequest,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { userId, tenantId } = context(request);
    return this.rolesService.createForTenant(
      userId,
      tenantId,
      body,
      idempotencyKey,
      correlationId(request),
    );
  }

  @Get(':id')
  @UseGuards(RequirePermission('role.read'))
  async getById(@Req() request: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    const { userId, tenantId } = context(request);
    return this.rolesService.getForTenant(userId, tenantId, id);
  }

  @Patch(':id')
  @HttpCode(200)
  @UseGuards(RequirePermission('role.manage'))
  async rename(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { userId, tenantId } = context(request);
    return this.rolesService.renameForTenant(
      userId,
      tenantId,
      id,
      body,
      idempotencyKey,
      correlationId(request),
    );
  }

  @Put(':id/permissions')
  @HttpCode(200)
  @UseGuards(RequirePermission('role.manage'))
  async replacePermissions(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { userId, tenantId } = context(request);
    return this.rolesService.replacePermissionsForTenant(
      userId,
      tenantId,
      id,
      body,
      idempotencyKey,
      correlationId(request),
    );
  }
}

function context(request: AuthedRequest): { userId: string; tenantId: string } {
  const auth = request[AUTH_CONTEXT_REQUEST_KEY];
  const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
  if (auth === undefined) {
    throw AppError.unauthorized();
  }
  if (tenant === undefined) {
    throw AppError.tenantContextRequired();
  }
  return { userId: auth.userId, tenantId: tenant.tenantId };
}

function correlationId(request: AuthedRequest): string {
  return request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';
}
