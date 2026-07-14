/**
 * Neutral DTO namespace for Payments.
 * Request/response contracts remain deferred until API Contract Freeze.
 */
export type PaymentsSkeletonDto = {
  readonly boundedContext: 'Payments';
  readonly status: 'skeleton';
};

export const PAYMENTS_SKELETON_DTO: PaymentsSkeletonDto = {
  boundedContext: 'Payments',
  status: 'skeleton',
};
