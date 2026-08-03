/**
 * SMS provider port (COMMS-001 / COMMS-003 / COMMS-004).
 * Opaque provider_code only — no vendor SDKs in domain models.
 */

export type SmsSendInput = {
  readonly tenantId: string;
  readonly requestId: string;
  readonly toE164: string;
  readonly body: string;
  /** Caller correlation for provider recipient_id / client ref. */
  readonly clientRef: string;
};

export type SmsSendResult = {
  readonly providerCode: string;
  readonly providerMessageId: string;
  readonly status: 'sent' | 'failed';
  readonly errorCode?: string;
  readonly errorMessage?: string;
};

export interface SmsProviderPort {
  readonly providerCode: string;
  send(input: SmsSendInput): Promise<SmsSendResult>;
}

export const SMS_PROVIDER_PORT = Symbol('SMS_PROVIDER_PORT');
