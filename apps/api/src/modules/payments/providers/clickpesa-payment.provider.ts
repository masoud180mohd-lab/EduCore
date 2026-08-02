/**
 * ClickPesa PaymentProviderPort (PAY-003 / PAY-002 / ADR-011).
 * Creates Order BillPay control numbers; does not post ledger.
 */

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error.js';
import {
  CLICKPESA_PROVIDER_CODE,
  loadClickPesaConfig,
  type ClickPesaConfig,
} from './clickpesa-config.js';
import { ClickPesaHttpClient } from './clickpesa-http.client.js';
import {
  clickPesaMajorToMinor,
  mapClickPesaStatus,
  minorToClickPesaMajor,
} from './clickpesa-money.js';
import type {
  PaymentProviderInitiateInput,
  PaymentProviderPort,
  PaymentProviderResult,
} from './payment-provider.port.js';

@Injectable()
export class ClickPesaPaymentProvider implements PaymentProviderPort {
  readonly providerCode = CLICKPESA_PROVIDER_CODE;
  private readonly client: ClickPesaHttpClient | null;

  constructor(
    config: ClickPesaConfig | null = loadClickPesaConfig(),
    client?: ClickPesaHttpClient | null,
  ) {
    if (client !== undefined) {
      this.client = client;
      return;
    }
    this.client = config === null ? null : new ClickPesaHttpClient(config);
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async initiate(input: PaymentProviderInitiateInput): Promise<PaymentProviderResult> {
    const client = this.requireClient();
    if (input.currency !== 'TZS') {
      throw AppError.validation('ClickPesa MVP supports TZS only.', { field: 'currency' });
    }
    let billAmount: number;
    try {
      billAmount = minorToClickPesaMajor(input.amountMinor);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid amountMinor.';
      throw AppError.validation(message, { field: 'amountMinor' });
    }

    const body = {
      billAmount,
      billPaymentMode: 'EXACT',
      billReference: input.reference,
      billDescription:
        input.description?.trim() ||
        `Invoice ${input.invoiceId.slice(0, 8)}…`,
    };

    const created = await client.postJson('/billpay/create-order-control-number', body);
    if (created.status === 200) {
      const billPayNumber = readBillPayNumber(created.body);
      if (billPayNumber === null) {
        throw new Error('ClickPesa create-order-control-number missing billPayNumber.');
      }
      return {
        providerCode: this.providerCode,
        providerRef: billPayNumber,
        status: 'pending',
        orderReference: input.reference,
      };
    }

    if (created.status === 409) {
      // Custom billReference already used — control number is the reference we sent (PAY-002).
      const recovered = await this.queryStatus(input.reference);
      return {
        ...recovered,
        providerRef: recovered.providerRef || input.reference,
        orderReference: input.reference,
        status: recovered.status === 'failed' ? 'pending' : recovered.status,
      };
    }

    throw new Error(
      `ClickPesa create-order-control-number failed (${String(created.status)}): ${JSON.stringify(created.body)}`,
    );
  }

  async queryStatus(orderReference: string): Promise<PaymentProviderResult> {
    const client = this.requireClient();
    const path = `/payments/${encodeURIComponent(orderReference)}`;
    const queried = await client.getJson(path);
    if (queried.status === 404) {
      return {
        providerCode: this.providerCode,
        providerRef: orderReference,
        status: 'pending',
        orderReference,
      };
    }
    if (queried.status !== 200) {
      throw new Error(
        `ClickPesa query payments failed (${String(queried.status)}): ${JSON.stringify(queried.body)}`,
      );
    }

    const rows = Array.isArray(queried.body) ? queried.body : [];
    if (rows.length === 0) {
      return {
        providerCode: this.providerCode,
        providerRef: orderReference,
        status: 'pending',
        orderReference,
      };
    }

    const first = rows[0] as Record<string, unknown>;
    const rawStatus = typeof first['status'] === 'string' ? first['status'] : 'PENDING';
    const mapped = mapClickPesaStatus(rawStatus);
    const status = mapped === 'ignored' ? 'pending' : mapped;
    const providerRef =
      typeof first['orderReference'] === 'string' && first['orderReference'] !== ''
        ? first['orderReference']
        : orderReference;

    const providerEventId =
      typeof first['id'] === 'string' && first['id'].trim() !== ''
        ? first['id'].trim()
        : typeof first['paymentReference'] === 'string' && first['paymentReference'].trim() !== ''
          ? first['paymentReference'].trim()
          : undefined;

    let amountMinor: number | undefined;
    if (first['collectedAmount'] !== undefined && first['collectedAmount'] !== null) {
      try {
        amountMinor = clickPesaMajorToMinor(first['collectedAmount'] as string | number);
      } catch {
        amountMinor = undefined;
      }
    }

    return {
      providerCode: this.providerCode,
      providerRef,
      status,
      orderReference,
      ...(providerEventId !== undefined ? { providerEventId } : {}),
      ...(amountMinor !== undefined ? { amountMinor } : {}),
    };
  }

  private requireClient(): ClickPesaHttpClient {
    if (this.client === null) {
      throw AppError.validation('ClickPesa is not configured (missing env secrets).');
    }
    return this.client;
  }
}

function readBillPayNumber(body: unknown): string | null {
  if (body === null || typeof body !== 'object') return null;
  const value = (body as Record<string, unknown>)['billPayNumber'];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
