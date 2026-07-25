import {
  Body,
  Controller,
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
import { MembershipsService } from '../application/memberships.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

/**
 * Product memberships surface (ACF-001 §4.6).
 *
 * GET  /api/v1/memberships              — list (user.read)
 * GET  /api/v1/memberships/:id          — detail (user.read)
 * POST /api/v1/memberships              — invite (user.invite) — IMP-001 P15
 * POST /api/v1/memberships/:id/suspend  — suspend (user.manage) — IMP-020
 * POST /api/v1/memberships/:id/reactivate — reactivate (user.manage) — IMP-020
 * POST /api/v1/memberships/:id/remove   — soft remove (user.manage) — IMP-020
 *
 * List query: limit, cursor, status, userId.
 * List response: { data, page: { nextCursor, limit } }.
 */
@Controller('api/v1/memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  @UseGuards(RequirePermission('user.read'))
  async list(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
    @Query('userId') filterUserId?: string,
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
    return this.membershipsService.listForTenant(auth.userId, tenant.tenantId, {
      limit,
      cursor,
      status,
      userId: filterUserId,
    });
  }

  @Post()
  @HttpCode(201)
  @UseGuards(RequirePermission('user.invite'))
  async create(
    @Req() request: AuthedRequest,
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

    // RequirePermission already enforced session↔header bind + user.invite.
    return this.membershipsService.inviteForTenant(
      auth.userId,
      tenant.tenantId,
      body,
      idempotencyKey,
      correlationId,
    );
  }

  @Post(':id/suspend')
  @HttpCode(200)
  @UseGuards(RequirePermission('user.manage'))
  async suspend(
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

    return this.membershipsService.suspendForTenant(
      auth.userId,
      tenant.tenantId,
      id,
      idempotencyKey,
      correlationId,
    );
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @UseGuards(RequirePermission('user.manage'))
  async reactivate(
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

    return this.membershipsService.reactivateForTenant(
      auth.userId,
      tenant.tenantId,
      id,
      idempotencyKey,
      correlationId,
    );
  }

  @Post(':id/remove')
  @HttpCode(200)
  @UseGuards(RequirePermission('user.manage'))
  async remove(
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

    return this.membershipsService.removeForTenant(
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

    // Bound tenant roster only; missing/cross-tenant → 404 (no enumeration).
    return this.membershipsService.getForTenant(auth.userId, tenant.tenantId, id);
  }
}
