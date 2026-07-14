import { Injectable } from '@nestjs/common';

/**
 * Domain-service placeholder for Payments.
 * Business rules are intentionally absent until an approved feature slice.
 */
@Injectable()
export class PaymentsDomainService {
  contextName(): string {
    return 'Payments';
  }
}
