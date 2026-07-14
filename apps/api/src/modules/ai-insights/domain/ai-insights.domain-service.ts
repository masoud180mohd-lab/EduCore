import { Injectable } from '@nestjs/common';

/**
 * Domain-service placeholder for AI Insights.
 * Business rules are intentionally absent until an approved feature slice.
 */
@Injectable()
export class AiInsightsDomainService {
  contextName(): string {
    return 'AI Insights';
  }
}
