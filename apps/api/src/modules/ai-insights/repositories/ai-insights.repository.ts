/**
 * Persistence contract for AI Insights.
 * No database adapter is provided before Database Freeze.
 */
export interface AiInsightsRepository {
  readonly boundedContext: 'AI Insights';
}

export const AI_INSIGHTS_REPOSITORY = Symbol('AI_INSIGHTS_REPOSITORY');
