/**
 * Fake AI provider (AI-002). Deterministic echo for CI/lab.
 */
import { Injectable } from '@nestjs/common';

import type {
  AiProviderGenerateInput,
  AiProviderGenerateResult,
  AiProviderPort,
} from './ai-gateway.port.js';

export const FAKE_AI_PROVIDER_CODE = 'fake';
export const FAKE_AI_MODEL_CODE = 'fake-echo-v1';

@Injectable()
export class FakeAiProvider implements AiProviderPort {
  readonly providerCode = FAKE_AI_PROVIDER_CODE;

  generate(input: AiProviderGenerateInput): Promise<AiProviderGenerateResult> {
    const outputText = input.renderedPrompt;
    return Promise.resolve({
      providerCode: this.providerCode,
      modelCode: FAKE_AI_MODEL_CODE,
      outputText,
      inputTokens: Math.max(1, Math.ceil(input.renderedPrompt.length / 4)),
      outputTokens: Math.max(1, Math.ceil(outputText.length / 4)),
      estimatedCostMinor: 0,
    });
  }
}
