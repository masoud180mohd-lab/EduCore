/**
 * OpenAI Chat Completions adapter (AI-006 / ACF-AI-006).
 * Uses fetch only — no OpenAI SDK dependency.
 */
import { Injectable } from '@nestjs/common';

import type {
  AiProviderGenerateInput,
  AiProviderGenerateResult,
  AiProviderPort,
} from './ai-gateway.port.js';
import {
  DEFAULT_OPENAI_MODEL,
  loadOpenAiConfig,
  OPENAI_PROVIDER_CODE,
  type OpenAiConfig,
} from './openai-config.js';
import { AiProviderNotConfiguredError } from './not-configured-ai.provider.js';

export type OpenAiFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

@Injectable()
export class OpenAiAiProvider implements AiProviderPort {
  readonly providerCode = OPENAI_PROVIDER_CODE;
  private readonly config: OpenAiConfig | null;
  private readonly fetchImpl: OpenAiFetch;

  constructor(config: OpenAiConfig | null = loadOpenAiConfig(), fetchImpl: OpenAiFetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  isConfigured(): boolean {
    return this.config !== null && this.config.apiKey !== '';
  }

  async generate(input: AiProviderGenerateInput): Promise<AiProviderGenerateResult> {
    const config = this.config;
    if (config === null) {
      throw new AiProviderNotConfiguredError(this.providerCode);
    }

    const url = `${config.baseUrl}/v1/chat/completions`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: [{ role: 'user', content: input.renderedPrompt }],
      }),
    });

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = extractOpenAiErrorMessage(body) ?? `HTTP ${String(response.status)}`;
      throw new Error(`OpenAI request failed: ${detail}`);
    }

    return mapOpenAiChatCompletion(body, config.model);
  }
}

export function mapOpenAiChatCompletion(
  body: unknown,
  fallbackModel: string = DEFAULT_OPENAI_MODEL,
): AiProviderGenerateResult {
  const obj =
    body !== null && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const choices = obj['choices'];
  const first =
    Array.isArray(choices) && choices.length > 0 && typeof choices[0] === 'object'
      ? (choices[0] as Record<string, unknown>)
      : null;
  const message =
    first !== null && typeof first['message'] === 'object' && first['message'] !== null
      ? (first['message'] as Record<string, unknown>)
      : null;
  const contentRaw = message?.['content'];
  const outputText = typeof contentRaw === 'string' ? contentRaw : '';

  const usage =
    typeof obj['usage'] === 'object' && obj['usage'] !== null
      ? (obj['usage'] as Record<string, unknown>)
      : {};
  const inputTokens = nonNegInt(
    usage['prompt_tokens'],
    Math.max(1, Math.ceil(outputText.length / 8)),
  );
  const outputTokens = nonNegInt(
    usage['completion_tokens'],
    Math.max(1, Math.ceil(outputText.length / 4)),
  );

  const modelRaw = obj['model'];
  const modelCode =
    typeof modelRaw === 'string' && modelRaw.trim() !== '' ? modelRaw : fallbackModel;

  return {
    providerCode: OPENAI_PROVIDER_CODE,
    modelCode,
    outputText,
    inputTokens,
    outputTokens,
    estimatedCostMinor: 0,
  };
}

function nonNegInt(raw: unknown, fallback: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return fallback;
}

function extractOpenAiErrorMessage(body: unknown): string | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const err = (body as Record<string, unknown>)['error'];
  if (err === null || typeof err !== 'object' || Array.isArray(err)) return null;
  const message = (err as Record<string, unknown>)['message'];
  return typeof message === 'string' ? message : null;
}
