/**
 * Neutral DTO namespace for Analytics.
 * Request/response contracts remain deferred until API Contract Freeze.
 */
export type AnalyticsSkeletonDto = {
  readonly boundedContext: 'Analytics';
  readonly status: 'skeleton';
};

export const ANALYTICS_SKELETON_DTO: AnalyticsSkeletonDto = {
  boundedContext: 'Analytics',
  status: 'skeleton',
};
