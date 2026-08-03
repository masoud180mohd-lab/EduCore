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
import { NotificationsService } from '../application/notifications.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

/**
 * Notifications / SMS product surface (COMMS-003 / ACF-014).
 */
@Controller()
export class NotificationsProductController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('api/v1/notification-templates')
  @UseGuards(RequirePermission('notification.read'))
  async listTemplates(@Req() request: AuthedRequest): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.notificationsService.listTemplatesForTenant(auth.userId, tenant.tenantId);
  }

  @Post('api/v1/notifications/requests')
  @HttpCode(201)
  @UseGuards(RequirePermission('notification.manage'))
  async createRequest(
    @Req() request: AuthedRequest,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.notificationsService.createRequestForTenant(
      auth.userId,
      tenant.tenantId,
      body,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Get('api/v1/notifications/requests/:requestId')
  @UseGuards(RequirePermission('notification.read'))
  async getRequest(
    @Req() request: AuthedRequest,
    @Param('requestId') requestId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.notificationsService.getRequestForTenant(auth.userId, tenant.tenantId, requestId);
  }

  @Get('api/v1/notifications/deliveries')
  @UseGuards(RequirePermission('notification.read'))
  async listDeliveries(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    const parsed = limit === undefined || limit === '' ? undefined : Number.parseInt(limit, 10);
    return this.notificationsService.listDeliveriesForTenant(
      auth.userId,
      tenant.tenantId,
      Number.isFinite(parsed) ? parsed : undefined,
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
