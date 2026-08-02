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
import { PaymentsService } from '../application/payments.service.js';

type AuthedRequest = Request & {
  [AUTH_CONTEXT_REQUEST_KEY]?: AuthContext;
  [TENANT_CONTEXT_REQUEST_KEY]?: TenantContext;
  [CORRELATION_ID_REQUEST_KEY]?: string;
  [REQUEST_ID_REQUEST_KEY]?: string;
};

/**
 * Manual payments + receipts product surface (IMP-009 / ACF-012).
 *
 * POST /api/v1/payments               — record manual payment (finance.manage + Idempotency-Key)
 * GET  /api/v1/payments/:id           — detail (finance.read)
 * POST /api/v1/payments/:id/reverse   — succeeded -> reversed (finance.manage + Idempotency-Key)
 * GET  /api/v1/invoices/:id/payments  — payments for an invoice (finance.read)
 * GET  /api/v1/receipts               — list (finance.read)
 * GET  /api/v1/receipts/:id           — detail (finance.read)
 */
@Controller()
export class PaymentsProductController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('api/v1/payments')
  @HttpCode(201)
  @UseGuards(RequirePermission('finance.manage'))
  async createPayment(
    @Req() request: AuthedRequest,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.paymentsService.createForTenant(
      auth.userId,
      tenant.tenantId,
      body,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Post('api/v1/payments/mobile-money')
  @HttpCode(201)
  @UseGuards(RequirePermission('finance.manage'))
  async createMobileMoney(
    @Req() request: AuthedRequest,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.paymentsService.createMobileMoneyForTenant(
      auth.userId,
      tenant.tenantId,
      body,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Post('api/v1/payments/sync-provider-pending')
  @HttpCode(200)
  @UseGuards(RequirePermission('finance.reconcile'))
  async syncPendingClickPesa(
    @Req() request: AuthedRequest,
    @Body() body: unknown,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.paymentsService.syncPendingClickPesaForTenant(
      auth.userId,
      tenant.tenantId,
      body,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Get('api/v1/payments/:paymentId')
  @UseGuards(RequirePermission('finance.read'))
  async getPayment(
    @Req() request: AuthedRequest,
    @Param('paymentId') paymentId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.paymentsService.getForTenant(auth.userId, tenant.tenantId, paymentId);
  }

  @Post('api/v1/payments/:paymentId/reverse')
  @HttpCode(200)
  @UseGuards(RequirePermission('finance.manage'))
  async reversePayment(
    @Req() request: AuthedRequest,
    @Param('paymentId') paymentId: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.paymentsService.reverseForTenant(
      auth.userId,
      tenant.tenantId,
      paymentId,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Post('api/v1/payments/:paymentId/reconcile')
  @HttpCode(200)
  @UseGuards(RequirePermission('finance.reconcile'))
  async reconcilePayment(
    @Req() request: AuthedRequest,
    @Param('paymentId') paymentId: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.paymentsService.reconcileForTenant(
      auth.userId,
      tenant.tenantId,
      paymentId,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Post('api/v1/payments/:paymentId/sync-provider')
  @HttpCode(200)
  @UseGuards(RequirePermission('finance.reconcile'))
  async syncProviderPayment(
    @Req() request: AuthedRequest,
    @Param('paymentId') paymentId: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.paymentsService.syncProviderForTenant(
      auth.userId,
      tenant.tenantId,
      paymentId,
      idempotencyKey,
      resolveCorrelationId(request),
    );
  }

  @Get('api/v1/invoices/:invoiceId/payments')
  @UseGuards(RequirePermission('finance.read'))
  async listPaymentsByInvoice(
    @Req() request: AuthedRequest,
    @Param('invoiceId') invoiceId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.paymentsService.listByInvoiceForTenant(auth.userId, tenant.tenantId, invoiceId);
  }

  @Get('api/v1/receipts')
  @UseGuards(RequirePermission('finance.read'))
  async listReceipts(
    @Req() request: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.paymentsService.listReceiptsForTenant(auth.userId, tenant.tenantId, {
      limit,
      cursor,
    });
  }

  @Get('api/v1/receipts/:receiptId')
  @UseGuards(RequirePermission('finance.read'))
  async getReceipt(
    @Req() request: AuthedRequest,
    @Param('receiptId') receiptId: string,
  ): Promise<unknown> {
    const { auth, tenant } = requireAuthTenant(request);
    return this.paymentsService.getReceiptForTenant(auth.userId, tenant.tenantId, receiptId);
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
