/**
 * Neutral DTO namespace for Platform Operations.
 * Request/response contracts remain deferred until API Contract Freeze.
 */
export type PlatformOperationsSkeletonDto = {
  readonly boundedContext: 'Platform Operations';
  readonly status: 'skeleton';
};

export const PLATFORM_OPERATIONS_SKELETON_DTO: PlatformOperationsSkeletonDto = {
  boundedContext: 'Platform Operations',
  status: 'skeleton',
};
