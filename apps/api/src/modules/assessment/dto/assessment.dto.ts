/**
 * Neutral DTO namespace for Assessment.
 * Request/response contracts remain deferred until API Contract Freeze.
 */
export type AssessmentSkeletonDto = {
  readonly boundedContext: 'Assessment';
  readonly status: 'skeleton';
};

export const ASSESSMENT_SKELETON_DTO: AssessmentSkeletonDto = {
  boundedContext: 'Assessment',
  status: 'skeleton',
};
