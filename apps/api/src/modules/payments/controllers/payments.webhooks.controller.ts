import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
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
import { PaymentsService } from '../application/payments.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

/**
 * Fake payment provider webhook stub (IMP-009 Wave G / PAY-PROVIDER-001).
 * No real MoMo vendor is wired (PAY-PROVIDER-001) — this exists purely to
 * exercise event dedupe. v1 requires RequireAuth + finance.manage rather
 * than a signature-header scheme, since no sandbox contract exists yet.
 *
 * POST /api/v1/payments/webhooks/fake — dedupe + acknowledge (finance.manage)
 */
@Controller()
export class PaymentsWebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('api/v1/payments/webhooks/fake')
  @HttpCode(200)
  @UseGuards(RequirePermission('finance.manage'))
  async handleFakeWebhook(@Req() request: AuthedRequest, @Body() body: unknown): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.paymentsService.handleFakeWebhookForTenant(
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
