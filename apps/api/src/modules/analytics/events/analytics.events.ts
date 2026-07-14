/**
 * Domain-event names for Analytics.
 * Event payloads and outbox publishing remain deferred.
 */
export const AnalyticsEventNames = {
  skeletonRegistered: 'analytics.skeleton.registered',
} as const;

export type AnalyticsSkeletonRegisteredEvent = {
  readonly eventName: typeof AnalyticsEventNames.skeletonRegistered;
  readonly boundedContext: 'Analytics';
};
