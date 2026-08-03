/**
 * Fake SMS provider (COMMS-003). Default CI/local — records deterministic message ids.
 */
import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { SmsProviderPort, SmsSendInput, SmsSendResult } from './sms-provider.port.js';

export const FAKE_SMS_PROVIDER_CODE = 'fake';

@Injectable()
export class FakeSmsProvider implements SmsProviderPort {
  readonly providerCode = FAKE_SMS_PROVIDER_CODE;

  send(input: SmsSendInput): Promise<SmsSendResult> {
    if (input.toE164.trim() === '' || input.body.trim() === '') {
      return Promise.resolve({
        providerCode: this.providerCode,
        providerMessageId: `fake_fail_${randomUUID()}`,
        status: 'failed',
        errorCode: 'INVALID_INPUT',
        errorMessage: 'Missing destination or body.',
      });
    }
    return Promise.resolve({
      providerCode: this.providerCode,
      providerMessageId: `fake_${input.clientRef}_${randomUUID()}`,
      status: 'sent',
    });
  }
}
