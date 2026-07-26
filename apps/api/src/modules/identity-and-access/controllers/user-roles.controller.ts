import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
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
import { UserRolesService } from '../application/user-roles.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

@Controller('api/v1/user-roles')
export class UserRolesController {
  constructor(private readonly userRolesService: UserRolesService) {}

  @Get()
  @UseGuards(RequirePermission('role.read'))
  async list(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('userId') userId?: string,
  ): Promise<unknown> {
    const context = getContext(request);
    return this.userRolesService.listForTenant(context.userId, context.tenantId, {
      limit,
      cursor,
      userId,
    });
  }

  @Post()
  @HttpCode(201)
  @UseGuards(RequirePermission('role.manage'))
  async assign(
    @Req() request: AuthedRequest,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const context = getContext(request);
    return this.userRolesService.assignForTenant(
      context.userId,
      context.tenantId,
      body,
      idempotencyKey,
      getCorrelationId(request),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(RequirePermission('role.manage'))
  async unassign(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<void> {
    const context = getContext(request);
    await this.userRolesService.unassignForTenant(
      context.userId,
      context.tenantId,
      id,
      idempotencyKey,
      getCorrelationId(request),
    );
  }
}

function getContext(request: AuthedRequest): { userId: string; tenantId: string } {
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

function getCorrelationId(request: AuthedRequest): string {
  return request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';
}
