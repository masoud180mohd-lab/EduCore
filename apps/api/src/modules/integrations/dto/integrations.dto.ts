/**
 * Neutral DTO namespace for Integrations.
 * Request/response contracts remain deferred until API Contract Freeze.
 */
export type IntegrationsSkeletonDto = {
  readonly boundedContext: 'Integrations';
  readonly status: 'skeleton';
};

export const INTEGRATIONS_SKELETON_DTO: IntegrationsSkeletonDto = {
  boundedContext: 'Integrations',
  status: 'skeleton',
};
