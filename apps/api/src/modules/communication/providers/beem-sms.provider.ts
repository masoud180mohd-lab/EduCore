/**
 * Beem SmsProviderPort (COMMS-004 / COMMS-001).
 * Submits one recipient per call; providerMessageId = Beem request_id.
 */

import { Injectable } from '@nestjs/common';

import { BEEM_PROVIDER_CODE, loadBeemConfig, type BeemConfig } from './beem-config.js';
import { BeemHttpClient } from './beem-http.client.js';
import type { SmsProviderPort, SmsSendInput, SmsSendResult } from './sms-provider.port.js';

@Injectable()
export class BeemSmsProvider implements SmsProviderPort {
  readonly providerCode = BEEM_PROVIDER_CODE;
  private readonly client: BeemHttpClient | null;
  private readonly sourceAddr: string;

  constructor(config: BeemConfig | null = loadBeemConfig(), client?: BeemHttpClient | null) {
    if (client !== undefined) {
      this.client = client;
      this.sourceAddr = config?.sourceAddr ?? '';
      return;
    }
    if (config === null) {
      this.client = null;
      this.sourceAddr = '';
      return;
    }
    this.client = new BeemHttpClient(config);
    this.sourceAddr = config.sourceAddr;
  }

  isConfigured(): boolean {
    return this.client !== null && this.sourceAddr !== '';
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const client = this.client;
    if (client === null || this.sourceAddr === '') {
      return {
        providerCode: this.providerCode,
        providerMessageId: `beem_unconfigured_${input.requestId}`,
        status: 'failed',
        errorCode: 'BEEM_NOT_CONFIGURED',
        errorMessage: 'Beem secrets missing; set SMS_PROVIDER=fake or configure BEEM_*.',
      };
    }

    const destAddr = input.toE164.replace(/\D/g, '');
    if (destAddr === '' || input.body.trim() === '') {
      return {
        providerCode: this.providerCode,
        providerMessageId: `beem_invalid_${input.requestId}`,
        status: 'failed',
        errorCode: 'INVALID_INPUT',
        errorMessage: 'Missing destination or body.',
      };
    }

    const response = await client.postSend({
      source_addr: this.sourceAddr,
      encoding: 0,
      schedule_time: '',
      message: input.body,
      recipients: [
        {
          recipient_id: input.clientRef.slice(0, 36),
          dest_addr: destAddr,
        },
      ],
    });

    return mapBeemSendResponse(response.status, response.body, input.requestId);
  }
}

export function mapBeemSendResponse(
  httpStatus: number,
  body: unknown,
  requestId: string,
): SmsSendResult {
  const obj =
    body !== null && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const successful = obj['successful'] === true || obj['successful'] === 'true';
  const requestIdRaw = obj['request_id'];
  const providerMessageId =
    typeof requestIdRaw === 'string' && requestIdRaw.trim() !== ''
      ? requestIdRaw.trim()
      : typeof requestIdRaw === 'number' && Number.isFinite(requestIdRaw)
        ? String(requestIdRaw)
        : `beem_http_${String(httpStatus)}_${requestId}`;

  const codeRaw = obj['code'];
  const messageRaw = obj['message'];
  const errorCode =
    typeof codeRaw === 'number' || typeof codeRaw === 'string' ? String(codeRaw) : undefined;
  const errorMessage = typeof messageRaw === 'string' ? messageRaw : undefined;

  if (httpStatus >= 200 && httpStatus < 300 && successful) {
    return {
      providerCode: BEEM_PROVIDER_CODE,
      providerMessageId,
      status: 'sent',
    };
  }

  return {
    providerCode: BEEM_PROVIDER_CODE,
    providerMessageId,
    status: 'failed',
    errorCode: errorCode ?? `HTTP_${String(httpStatus)}`,
    errorMessage: errorMessage ?? `Beem send failed (HTTP ${String(httpStatus)}).`,
  };
}
