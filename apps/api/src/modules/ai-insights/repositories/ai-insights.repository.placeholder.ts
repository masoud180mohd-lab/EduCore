import { Injectable } from '@nestjs/common';

import type { AiInsightsRepository } from './ai-insights.repository.js';

/**
 * Non-persistent repository placeholder for AI Insights.
 */
@Injectable()
export class AiInsightsRepositoryPlaceholder implements AiInsightsRepository {
  readonly boundedContext = 'AI Insights' as const;
}
