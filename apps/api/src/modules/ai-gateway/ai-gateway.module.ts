import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/persistence/index.js';
import { resolveAiProviderName } from './application/ai-feature-gate.js';
import { AiGatewayService } from './application/ai-gateway.service.js';
import { AiLabService } from './application/ai-lab.service.js';
import { AiGatewayController } from './controllers/ai-gateway.controller.js';
import { AI_GATEWAY_PORT, AI_PROVIDER_PORT } from './providers/ai-gateway.port.js';
import { FakeAiProvider } from './providers/fake-ai.provider.js';
import { AiGatewayRepository } from './repositories/ai-gateway.repository.js';

/**
 * AI Gateway (EPIC-AI-01 / ADR-003).
 * Default provider: Fake. Kill switch via AI_PLATFORM_ENABLED / AI_PROVIDER=disabled.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [AiGatewayController],
  providers: [
    AiGatewayRepository,
    FakeAiProvider,
    {
      provide: AI_PROVIDER_PORT,
      useFactory: (fake: FakeAiProvider): FakeAiProvider => {
        // Skeleton: only fake | disabled. disabled is handled in gateway before provider call.
        void resolveAiProviderName();
        return fake;
      },
      inject: [FakeAiProvider],
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
