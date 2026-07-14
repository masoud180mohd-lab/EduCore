import { Injectable } from '@nestjs/common';

import type { AnalyticsRepository } from './analytics.repository.js';

/**
 * Non-persistent repository placeholder for Analytics.
 */
@Injectable()
export class AnalyticsRepositoryPlaceholder implements AnalyticsRepository {
  readonly boundedContext = 'Analytics' as const;
}
