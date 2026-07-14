/**
 * Persistence contract for Analytics.
 * No database adapter is provided before Database Freeze.
 */
export interface AnalyticsRepository {
  readonly boundedContext: 'Analytics';
}

export const ANALYTICS_REPOSITORY = Symbol('ANALYTICS_REPOSITORY');
