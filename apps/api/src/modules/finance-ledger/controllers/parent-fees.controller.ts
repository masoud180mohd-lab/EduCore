import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/index.js';
import type { AuthContext } from '../../../common/auth/auth-context.js';
import { AppError } from '../../../common/errors/app-error.js';
import { RequirePermission } from '../../../common/policy/index.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import type { TenantContext } from '../../../common/tenant/tenant-context.js';
import { ParentFeesService } from '../application/parent-fees.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
};

/**
 * Parent portal fees (ACF-013) — read-only, linked-student isolation.
 */
@Controller()
export class ParentFeesController {
  constructor(private readonly parentFees: ParentFeesService) {}

  @Get('api/v1/me/fees/invoices')
  @UseGuards(RequirePermission('parent.finance.read'))
  async listInvoices(
    @Req() request: AuthedRequest,
    @Query('studentId') studentId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.parentFees.listInvoicesForStudent(auth.userId, tenant.tenantId, {
      studentId,
      limit,
      cursor,
      status,
    });
  }

  @Get('api/v1/me/fees/invoices/:invoiceId')
  @UseGuards(RequirePermission('parent.finance.read'))
  async getInvoice(
    @Req() request: AuthedRequest,
    @Param('invoiceId') invoiceId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.parentFees.getInvoice(auth.userId, tenant.tenantId, invoiceId);
  }

  @Get('api/v1/me/fees/invoices/:invoiceId/payments')
  @UseGuards(RequirePermission('parent.finance.read'))
  async listPayments(
    @Req() request: AuthedRequest,
    @Param('invoiceId') invoiceId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.parentFees.listPayments(auth.userId, tenant.tenantId, invoiceId);
  }

  @Get('api/v1/me/fees/receipts/:receiptId')
  @UseGuards(RequirePermission('parent.finance.read'))
  async getReceipt(
    @Req() request: AuthedRequest,
    @Param('receiptId') receiptId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.parentFees.getReceipt(auth.userId, tenant.tenantId, receiptId);
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
