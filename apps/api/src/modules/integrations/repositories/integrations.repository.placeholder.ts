import { Injectable } from '@nestjs/common';

import type { IntegrationsRepository } from './integrations.repository.js';

/**
 * Non-persistent repository placeholder for Integrations.
 */
@Injectable()
export class IntegrationsRepositoryPlaceholder implements IntegrationsRepository {
  readonly boundedContext = 'Integrations' as const;
}
