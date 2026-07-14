import { Injectable } from '@nestjs/common';

/**
 * Domain-service placeholder for Analytics.
 * Business rules are intentionally absent until an approved feature slice.
 */
@Injectable()
export class AnalyticsDomainService {
  contextName(): string {
    return 'Analytics';
  }
}
