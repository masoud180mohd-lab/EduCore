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
import { InvoicesService } from '../application/invoices.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

/**
 * Invoices product surface (IMP-009 / ACF-012).
 *
 * GET  /api/v1/invoices            — list (finance.read)
 * POST /api/v1/invoices            — create draft (finance.manage + Idempotency-Key)
 * GET  /api/v1/invoices/:id        — detail with lines (finance.read)
 * POST /api/v1/invoices/:id/issue  — draft -> issued (finance.manage + Idempotency-Key)
 * POST /api/v1/invoices/:id/void   — issued -> void (finance.manage + Idempotency-Key)
 */
@Controller()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('api/v1/invoices')
  @UseGuards(RequirePermission('finance.read'))
  async listInvoices(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('studentId') studentId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('status') status?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.invoicesService.listForTenant(auth.userId, tenant.tenantId, {
      limit,
      cursor,
      studentId,
      academicYearId,
      status,
    });
  }

  @Post('api/v1/invoices')
  @HttpCode(201)
  @UseGuards(RequirePermission('finance.manage'))
  async createInvoice(
    @Req() request: AuthedRequest,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.invoicesService.createForTenant(
      auth.userId,
      tenant.tenantId,
      body,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Get('api/v1/invoices/:invoiceId')
  @UseGuards(RequirePermission('finance.read'))
  async getInvoice(
    @Req() request: AuthedRequest,
    @Param('invoiceId') invoiceId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.invoicesService.getForTenant(auth.userId, tenant.tenantId, invoiceId);
  }

  @Post('api/v1/invoices/:invoiceId/issue')
  @UseGuards(RequirePermission('finance.manage'))
  async issueInvoice(
    @Req() request: AuthedRequest,
    @Param('invoiceId') invoiceId: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.invoicesService.issueForTenant(
      auth.userId,
      tenant.tenantId,
      invoiceId,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Post('api/v1/invoices/:invoiceId/void')
  @HttpCode(200)
  @UseGuards(RequirePermission('finance.manage'))
  async voidInvoice(
    @Req() request: AuthedRequest,
    @Param('invoiceId') invoiceId: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.invoicesService.voidForTenant(
      auth.userId,
      tenant.tenantId,
      invoiceId,
      idempotencyKey,
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
