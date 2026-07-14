/**
 * Persistence contract for Payments.
 * No database adapter is provided before Database Freeze.
 */
export interface PaymentsRepository {
  readonly boundedContext: 'Payments';
}

export const PAYMENTS_REPOSITORY = Symbol('PAYMENTS_REPOSITORY');
