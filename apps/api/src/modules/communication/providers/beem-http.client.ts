/**
 * Minimal Beem SMS HTTP client (COMMS-004).
 * Basic auth: base64(api_key:secret_key); POST /v1/send.
 */

import type { BeemConfig } from './beem-config.js';

export type BeemHttpFetch = (
  input: string,
  init?: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: string;
  },
) => Promise<{
  readonly status: number;
  readonly ok: boolean;
  readonly text: () => Promise<string>;
}>;

export type BeemSendPayload = {
  readonly source_addr: string;
  readonly encoding: number;
  readonly schedule_time: string;
  readonly message: string;
  readonly recipients: ReadonlyArray<{
    readonly recipient_id: string;
    readonly dest_addr: string;
  }>;
};

export class BeemHttpClient {
  constructor(
    private readonly config: BeemConfig,
    private readonly fetchImpl: BeemHttpFetch = globalThis.fetch.bind(globalThis),
  ) {}

  authorizationHeader(): string {
    const token = Buffer.from(`${this.config.apiKey}:${this.config.secretKey}`, 'utf8').toString(
      'base64',
    );
    return `Basic ${token}`;
  }

  async postSend(payload: BeemSendPayload): Promise<{ status: number; body: unknown }> {
    const response = await this.fetchImpl(`${this.config.baseUrl}/v1/send`, {
      method: 'POST',
      headers: {
        'Authorization': this.authorizationHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let parsed: unknown = null;
    if (text !== '') {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = { raw: text };
      }
    }
    return { status: response.status, body: parsed };
  }
}
