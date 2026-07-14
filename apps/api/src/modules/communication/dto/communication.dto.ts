/**
 * Neutral DTO namespace for Communication.
 * Request/response contracts remain deferred until API Contract Freeze.
 */
export type CommunicationSkeletonDto = {
  readonly boundedContext: 'Communication';
  readonly status: 'skeleton';
};

export const COMMUNICATION_SKELETON_DTO: CommunicationSkeletonDto = {
  boundedContext: 'Communication',
  status: 'skeleton',
};
