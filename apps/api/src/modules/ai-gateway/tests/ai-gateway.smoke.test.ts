/**
 * AI Gateway module smoke (AI-002).
 */
import { describe, expect, it } from 'vitest';

import { AiGatewayModule } from '../ai-gateway.module.js';
import { AiGatewayService } from '../application/ai-gateway.service.js';
import { RUNTIME_AI_FEATURE_ALLOWLIST } from '../application/ai-feature-gate.js';
import { FakeAiProvider } from '../providers/fake-ai.provider.js';

describe('AiGatewayModule smoke', () => {
  it('exports module and Fake provider', () => {
    expect(AiGatewayModule).toBeDefined();
    expect(new FakeAiProvider().providerCode).toBe('fake');
    expect(RUNTIME_AI_FEATURE_ALLOWLIST.has('lab.echo')).toBe(true);
    expect(AiGatewayService).toBeDefined();
  });
});
