/**
 * Neutral DTO namespace for AI Insights.
 * Request/response contracts remain deferred until API Contract Freeze.
 */
export type AiInsightsSkeletonDto = {
  readonly boundedContext: 'AI Insights';
  readonly status: 'skeleton';
};

export const AI_INSIGHTS_SKELETON_DTO: AiInsightsSkeletonDto = {
  boundedContext: 'AI Insights',
  status: 'skeleton',
};
