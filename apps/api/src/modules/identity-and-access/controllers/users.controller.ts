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

import {
  AUTH_CONTEXT_REQUEST_KEY,
  RequireActiveMembershipGuard,
} from '../../../common/auth/index.js';
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
import { UsersService } from '../application/users.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

/**
 * Product users surface (ACF-001).
 *
 * GET   /api/v1/users           — list (user.read)
 * GET   /api/v1/users/:id       — detail (user.read)
 * PATCH /api/v1/users/:id       — displayName (user.manage OR self) — P17
 * POST  /api/v1/users/:id/disable — disable (user.manage) — IMP-016
 * POST  /api/v1/users/:id/enable  — enable (user.manage) — IMP-021
 * No POST create / DELETE (invite via memberships).
 *
 * List query: limit, cursor, status, search.
 * List response: { data, page: { nextCursor, limit } }.
 */
@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RequirePermission('user.read'))
  async list(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
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

    // RequirePermission already enforced session↔header bind + user.read.
    return this.usersService.listForTenant(auth.userId, tenant.tenantId, {
      limit,
      cursor,
      status,
      search,
    });
  }

  @Post(':id/disable')
  @HttpCode(200)
  @UseGuards(RequirePermission('user.manage'))
  async disable(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw AppError.unauthorized();
    }
    if (tenant === undefined) {
      throw AppError.tenantContextRequired();
    }

    const correlationId =
      request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';

    return this.usersService.disableForTenant(
      auth.userId,
      tenant.tenantId,
      id,
      idempotencyKey,
      correlationId,
    );
  }

  @Post(':id/enable')
  @HttpCode(200)
  @UseGuards(RequirePermission('user.manage'))
  async enable(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw AppError.unauthorized();
    }
    if (tenant === undefined) {
      throw AppError.tenantContextRequired();
    }

    const correlationId =
      request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';

    return this.usersService.enableForTenant(
      auth.userId,
      tenant.tenantId,
      id,
      idempotencyKey,
      correlationId,
    );
  }

  @Get(':id')
  @UseGuards(RequirePermission('user.read'))
  async getById(@Req() request: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw AppError.unauthorized();
    }
    if (tenant === undefined) {
      throw AppError.tenantContextRequired();
    }

    return this.usersService.getForTenant(auth.userId, tenant.tenantId, id);
  }

  @Patch(':id')
  @UseGuards(RequireActiveMembershipGuard)
  async patch(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const auth = request[AUTH_CONTEXT_REQUEST_KEY];
    const tenant = request[TENANT_CONTEXT_REQUEST_KEY];
    if (auth === undefined) {
      throw AppError.unauthorized();
    }
    if (tenant === undefined) {
      throw AppError.tenantContextRequired();
    }

    const correlationId =
      request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';

    // Session bind + active membership enforced by guard; manage-or-self in service.
    return this.usersService.patchForTenant(
      auth.userId,
      tenant.tenantId,
      id,
      body,
      idempotencyKey,
      correlationId,
    );
  }
}
