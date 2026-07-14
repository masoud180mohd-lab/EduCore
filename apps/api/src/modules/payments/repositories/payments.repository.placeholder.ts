import { Injectable } from '@nestjs/common';

import type { PaymentsRepository } from './payments.repository.js';

/**
 * Non-persistent repository placeholder for Payments.
 */
@Injectable()
export class PaymentsRepositoryPlaceholder implements PaymentsRepository {
  readonly boundedContext = 'Payments' as const;
}
