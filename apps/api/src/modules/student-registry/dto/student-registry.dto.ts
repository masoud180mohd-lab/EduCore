/**
 * Neutral DTO namespace for Student Registry.
 * Request/response contracts remain deferred until API Contract Freeze.
 */
export type StudentRegistrySkeletonDto = {
  readonly boundedContext: 'Student Registry';
  readonly status: 'skeleton';
};

export const STUDENT_REGISTRY_SKELETON_DTO: StudentRegistrySkeletonDto = {
  boundedContext: 'Student Registry',
  status: 'skeleton',
};
