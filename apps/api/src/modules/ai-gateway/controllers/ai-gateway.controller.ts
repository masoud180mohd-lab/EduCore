/**
 * AI gateway lab HTTP (ACF-AI-001).
 */
import {
  Body,
  Controller,
  Get,
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
import { RequirePermission } from '../../../common/policy/index.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import type { TenantContext } from '../../../common/tenant/tenant-context.js';
import { AiLabService } from '../application/ai-lab.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

@Controller()
export class AiGatewayController {
  constructor(private readonly lab: AiLabService) {}

  @Get('api/v1/ai/prompts')
  @UseGuards(RequirePermission('ai.read'))
  async listPrompts(
    @Req() request: AuthedRequest,
    @Query('code') code?: string,
    @Query('locale') locale?: string,
    @Query('includeRetired') includeRetired?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.lab.listPromptsForTenant(auth.userId, tenant.tenantId, {
      code,
      locale,
      includeRetired,
    });
  }

  @Get('api/v1/ai/usage')
  @UseGuards(RequirePermission('ai.read'))
  async getUsage(
    @Req() request: AuthedRequest,
    @Query('date') date?: string,
    @Query('featureCode') featureCode?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.lab.getUsageForTenant(auth.userId, tenant.tenantId, date, featureCode);
  }

  @Get('api/v1/ai/invokes/:requestId')
  @UseGuards(RequirePermission('ai.read'))
  async getInvoke(
    @Req() request: AuthedRequest,
    @Param('requestId') requestId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.lab.getInvokeForTenant(auth.userId, tenant.tenantId, requestId);
  }

  @Post('api/v1/ai/lab/invoke')
  @HttpCode(200)
  @UseGuards(RequirePermission('ai.manage'))
  async labInvoke(@Req() request: AuthedRequest, @Body() body: unknown): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.lab.labInvokeForTenant(
      auth.userId,
      tenant.tenantId,
      body,
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
