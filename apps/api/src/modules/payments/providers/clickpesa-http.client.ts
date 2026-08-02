/**
 * Minimal ClickPesa HTTP client (PAY-003).
 * Token cache ~50 minutes (vendor JWT lasts 1 hour).
 */

import type { ClickPesaConfig } from './clickpesa-config.js';

export type ClickPesaHttpFetch = (
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
  readonly json: () => Promise<unknown>;
}>;

const TOKEN_TTL_MS = 50 * 60 * 1000;

export class ClickPesaHttpClient {
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly config: ClickPesaConfig,
    private readonly fetchImpl: ClickPesaHttpFetch = globalThis.fetch.bind(globalThis),
  ) {}

  async getAuthorizationHeader(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken !== null && now < this.tokenExpiresAt) {
      return this.cachedToken;
    }
    const response = await this.fetchImpl(`${this.config.baseUrl}/generate-token`, {
      method: 'POST',
      headers: {
        'client-id': this.config.clientId,
        'api-key': this.config.apiKey,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ClickPesa generate-token failed (${String(response.status)}): ${body}`);
    }
    const json = (await response.json()) as { token?: unknown };
    const token = typeof json.token === 'string' ? json.token.trim() : '';
    if (token === '') {
      throw new Error('ClickPesa generate-token response missing token.');
    }
    // Vendor may return "Bearer …" already — normalize to a single Authorization value.
    this.cachedToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    this.tokenExpiresAt = now + TOKEN_TTL_MS;
    return this.cachedToken;
  }

  clearTokenCache(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  async postJson(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
    const auth = await this.getAuthorizationHeader();
    const response = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

  async getJson(path: string): Promise<{ status: number; body: unknown }> {
    const auth = await this.getAuthorizationHeader();
    const response = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        Authorization: auth,
      },
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
