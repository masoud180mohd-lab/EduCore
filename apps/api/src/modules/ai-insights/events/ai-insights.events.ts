/**
 * Domain-event names for AI Insights.
 * Event payloads and outbox publishing remain deferred.
 */
export const AiInsightsEventNames = {
  skeletonRegistered: 'ai-insights.skeleton.registered',
} as const;

export type AiInsightsSkeletonRegisteredEvent = {
  readonly eventName: typeof AiInsightsEventNames.skeletonRegistered;
  readonly boundedContext: 'AI Insights';
};
