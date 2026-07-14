/**
 * Neutral DTO namespace for Identity And Access.
 * Request/response contracts remain deferred until API Contract Freeze.
 */
export type IdentityAndAccessSkeletonDto = {
  readonly boundedContext: 'Identity And Access';
  readonly status: 'skeleton';
};

export const IDENTITY_AND_ACCESS_SKELETON_DTO: IdentityAndAccessSkeletonDto = {
  boundedContext: 'Identity And Access',
  status: 'skeleton',
};
