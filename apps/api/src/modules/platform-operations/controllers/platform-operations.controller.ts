import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
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
import { PlatformOperationsApplicationService } from '../application/platform-operations.application-service.js';
import { RequirePlatformOperator } from '../policies/platform-operator.guard.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

/**
 * Platform Super Admin HTTP (ACF-PLAT-001).
 * No X-Tenant-Id. Guard is capability + optional MFA on writes.
 */
@Controller('api/v1/platform')
export class PlatformOperationsController {
  constructor(private readonly platform: PlatformOperationsApplicationService) {}

  @Get('tenants')
  @UseGuards(RequirePlatformOperator())
  async listTenants(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
  ): Promise<unknown> {
    return this.platform.listTenants(actorId(request), { limit, cursor, status });
  }

  @Post('tenants')
  @HttpCode(201)
  @UseGuards(RequirePlatformOperator({ write: true }))
  async registerTenant(
    @Req() request: AuthedRequest,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    return this.platform.registerTenant(actorId(request), body, idempotencyKey, correlationId(request));
  }

  @Get('tenants/:id')
  @UseGuards(RequirePlatformOperator())
  async getTenant(@Req() request: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    return this.platform.getTenant(actorId(request), id);
  }

  @Post('tenants/:id/suspend')
  @HttpCode(200)
  @UseGuards(RequirePlatformOperator({ write: true }))
  async suspend(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.platform.suspendTenant(actorId(request), id, body, correlationId(request));
  }

  @Post('tenants/:id/reinstate')
  @HttpCode(200)
  @UseGuards(RequirePlatformOperator({ write: true }))
  async reinstate(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.platform.reinstateTenant(actorId(request), id, body, correlationId(request));
  }

  @Get('plans')
  @UseGuards(RequirePlatformOperator())
  async listPlans(@Req() request: AuthedRequest): Promise<unknown> {
    return this.platform.listPlans(actorId(request));
  }

  @Put('tenants/:id/plan')
  @UseGuards(RequirePlatformOperator({ write: true }))
  async assignPlan(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.platform.assignPlan(actorId(request), id, body, correlationId(request));
  }

  @Put('tenants/:id/entitlements/:code')
  @UseGuards(RequirePlatformOperator({ write: true }))
  async setEntitlement(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Param('code') code: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.platform.setEntitlement(actorId(request), id, code, body, correlationId(request));
  }

  @Get('audit')
  @UseGuards(RequirePlatformOperator())
  async listAudit(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('tenantId') tenantId?: string,
    @Query('action') action?: string,
  ): Promise<unknown> {
    return this.platform.listAudit(actorId(request), { limit, cursor, tenantId, action });
  }
}

function actorId(request: AuthedRequest): string {
  const auth = request[AUTH_CONTEXT_REQUEST_KEY];
  if (auth === undefined) {
    throw AppError.unauthorized();
  }
  return auth.userId;
}

function correlationId(request: AuthedRequest): string {
  return request[CORRELATION_ID_REQUEST_KEY] ?? request[REQUEST_ID_REQUEST_KEY] ?? 'unknown';
}
