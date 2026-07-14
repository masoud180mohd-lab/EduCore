import { Injectable } from '@nestjs/common';

import type { CommunicationRepository } from './communication.repository.js';

/**
 * Non-persistent repository placeholder for Communication.
 */
@Injectable()
export class CommunicationRepositoryPlaceholder implements CommunicationRepository {
  readonly boundedContext = 'Communication' as const;
}
