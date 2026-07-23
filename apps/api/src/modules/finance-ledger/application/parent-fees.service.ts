/**
 * Parent-scoped fees reads (ACF-013). Never grant bursar finance.read to parents.
 */
import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import type { PaginatedResponse } from '../../../common/pagination/index.js';
import { isUuid } from '../../../common/tenant/tenant-context.js';
import { PaymentsService } from '../../payments/index.js';
import { GuardiansService } from '../../student-registry/index.js';
import { InvoicesService } from './invoices.service.js';

@Injectable()
export class ParentFeesService {
  constructor(
    private readonly guardians: GuardiansService,
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
  ) {}

  async listInvoicesForStudent(
    actorUserId: string,
    tenantId: string,
    rawQuery: {
      readonly studentId?: unknown;
      readonly limit?: unknown;
      readonly cursor?: unknown;
      readonly status?: unknown;
    },
  ): Promise<PaginatedResponse<unknown>> {
    const allowlist = await this.guardians.resolveActiveLinkedStudentIds(actorUserId, tenantId);
    if (typeof rawQuery.studentId !== 'string' || !isUuid(rawQuery.studentId)) {
      throw AppError.validation('studentId is required and must be a UUID.', {
        field: 'studentId',
      });
    }
    const studentId = rawQuery.studentId.toLowerCase();
    if (!allowlist.has(studentId)) {
      throw AppError.forbidden('Student is not linked to your guardian account.');
    }
    return this.invoices.listForTenant(actorUserId, tenantId, {
      studentId,
      limit: rawQuery.limit,
      cursor: rawQuery.cursor,
      status: rawQuery.status,
    });
  }

  async getInvoice(actorUserId: string, tenantId: string, invoiceId: string): Promise<unknown> {
    const allowlist = await this.guardians.resolveActiveLinkedStudentIds(actorUserId, tenantId);
    const result = await this.invoices.getForTenant(actorUserId, tenantId, invoiceId);
    if (!allowlist.has(result.data.studentId.toLowerCase())) {
      throw AppError.forbidden('Invoice is not for a student linked to you.');
    }
    return result;
  }

  async listPayments(actorUserId: string, tenantId: string, invoiceId: string): Promise<unknown> {
    await this.getInvoice(actorUserId, tenantId, invoiceId);
    return this.payments.listByInvoiceForTenant(actorUserId, tenantId, invoiceId);
  }

  async getReceipt(actorUserId: string, tenantId: string, receiptId: string): Promise<unknown> {
    const allowlist = await this.guardians.resolveActiveLinkedStudentIds(actorUserId, tenantId);
    const receipt = await this.payments.getReceiptForTenant(actorUserId, tenantId, receiptId);
    const payment = await this.payments.getForTenant(
      actorUserId,
      tenantId,
      receipt.data.paymentAttemptId,
    );
    const invoice = await this.invoices.getForTenant(actorUserId, tenantId, payment.data.invoiceId);
    if (!allowlist.has(invoice.data.studentId.toLowerCase())) {
      throw AppError.forbidden('Receipt is not for a student linked to you.');
    }
    return {
      data: {
        ...receipt.data,
        payment: {
          id: payment.data.id,
          invoiceId: payment.data.invoiceId,
          method: payment.data.method,
          amountMinor: payment.data.amountMinor,
          currency: payment.data.currency,
          status: payment.data.status,
        },
      },
    };
  }
}
