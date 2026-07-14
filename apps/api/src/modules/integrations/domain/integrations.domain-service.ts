import { Injectable } from '@nestjs/common';

/**
 * Domain-service placeholder for Integrations.
 * Business rules are intentionally absent until an approved feature slice.
 */
@Injectable()
export class IntegrationsDomainService {
  contextName(): string {
    return 'Integrations';
  }
}
