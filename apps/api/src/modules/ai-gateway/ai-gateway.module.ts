import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/persistence/index.js';
import { resolveAiProviderName } from './application/ai-feature-gate.js';
import { AiGatewayService } from './application/ai-gateway.service.js';
import { AiLabService } from './application/ai-lab.service.js';
import { AiGatewayController } from './controllers/ai-gateway.controller.js';
import { AI_GATEWAY_PORT, AI_PROVIDER_PORT } from './providers/ai-gateway.port.js';
import type { AiProviderPort } from './providers/ai-gateway.port.js';
import { FakeAiProvider } from './providers/fake-ai.provider.js';
import { NotConfiguredAiProvider } from './providers/not-configured-ai.provider.js';
import { OpenAiAiProvider } from './providers/openai-ai.provider.js';
import { loadOpenAiConfig, OPENAI_PROVIDER_CODE } from './providers/openai-config.js';
import { AiGatewayRepository } from './repositories/ai-gateway.repository.js';

/**
 * AI Gateway (EPIC-AI-01 / ADR-003 / AI-006).
 * Default provider: Fake. OpenAI when AI_PROVIDER=openai and key present.
 * openai without key → NotConfigured (never silent Fake).
 */
@Module({
  imports: [DatabaseModule],
  controllers: [AiGatewayController],
  providers: [
    AiGatewayRepository,
    FakeAiProvider,
    {
      provide: OpenAiAiProvider,
      useFactory: (): OpenAiAiProvider => new OpenAiAiProvider(loadOpenAiConfig()),
    },
    {
      provide: AI_PROVIDER_PORT,
      useFactory: (fake: FakeAiProvider, openai: OpenAiAiProvider): AiProviderPort => {
        const name = resolveAiProviderName();
        if (name === 'openai') {
          if (openai.isConfigured()) return openai;
          return new NotConfiguredAiProvider(OPENAI_PROVIDER_CODE);
        }
        // disabled is handled in gateway before provider call; Fake remains bound.
        return fake;
      },
      inject: [FakeAiProvider, OpenAiAiProvider],
    },
    AiGatewayService,
    {
      provide: AI_GATEWAY_PORT,
      useExisting: AiGatewayService,
    },
    AiLabService,
  ],
  exports: [AiGatewayService, AI_GATEWAY_PORT, AiLabService],
})
export class AiGatewayModule {}
