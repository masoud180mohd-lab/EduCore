import { Injectable } from '@nestjs/common';

import type { PlatformOperationsRepository } from './platform-operations.repository.js';

/**
 * Non-persistent repository placeholder for Platform Operations.
 */
@Injectable()
export class PlatformOperationsRepositoryPlaceholder implements PlatformOperationsRepository {
  readonly boundedContext = 'Platform Operations' as const;
}
