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
import { GuardiansService } from '../application/guardians.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

/**
 * Guardians product surface (ACF-010 / DBF-010) — Student Registry ownership.
 */
@Controller()
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Get('api/v1/guardians')
  @UseGuards(RequirePermission('guardian.read'))
  async list(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.guardiansService.listForTenant(auth.userId, tenant.tenantId, {
      limit,
      cursor,
      status,
      search,
    });
  }

  @Post('api/v1/guardians')
  @HttpCode(201)
  @UseGuards(RequirePermission('guardian.manage'))
  async create(
    @Req() request: AuthedRequest,
    @Body() body: Record<string, unknown>,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.guardiansService.createForTenant(
      auth.userId,
      tenant.tenantId,
      asRecord(body),
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Get('api/v1/guardians/:id')
  @UseGuards(RequirePermission('guardian.read'))
  async get(@Req() request: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.guardiansService.getForTenant(auth.userId, tenant.tenantId, id);
  }

  @Patch('api/v1/guardians/:id')
  @UseGuards(RequirePermission('guardian.manage'))
  async patch(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.guardiansService.patchForTenant(
      auth.userId,
      tenant.tenantId,
      id,
      asRecord(body),
      resolveCorrelationId(request),
    );
  }

  @Get('api/v1/guardians/:id/links')
  @UseGuards(RequirePermission('guardian.read'))
  async listLinks(@Req() request: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.guardiansService.listLinksForGuardian(auth.userId, tenant.tenantId, id);
  }

  @Post('api/v1/guardians/:id/links')
  @HttpCode(201)
  @UseGuards(RequirePermission('guardian.manage'))
  async createLink(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.guardiansService.createLinkForGuardian(
      auth.userId,
      tenant.tenantId,
      id,
      asRecord(body),
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Post('api/v1/guardians/:id/links/:linkId/end')
  @HttpCode(200)
  @UseGuards(RequirePermission('guardian.manage'))
  async endLink(
    @Req() request: AuthedRequest,
    @Param('id') id: string,
    @Param('linkId') linkId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.guardiansService.endLinkForGuardian(
      auth.userId,
      tenant.tenantId,
      id,
      linkId,
      resolveCorrelationId(request),
    );
  }

  @Get('api/v1/students/:studentId/guardians')
  @UseGuards(RequirePermission('guardian.read'))
  async listForStudent(
    @Req() request: AuthedRequest,
    @Param('studentId') studentId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.guardiansService.listLinksForStudent(auth.userId, tenant.tenantId, studentId);
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

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
