import { Injectable } from '@nestjs/common';

import type { IdentityAndAccessRepository } from './identity-and-access.repository.js';

/**
 * Non-persistent repository placeholder for Identity And Access.
 */
@Injectable()
export class IdentityAndAccessRepositoryPlaceholder implements IdentityAndAccessRepository {
  readonly boundedContext = 'Identity And Access' as const;
}
