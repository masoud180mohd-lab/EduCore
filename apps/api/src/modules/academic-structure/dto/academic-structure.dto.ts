/**
 * Neutral DTO namespace for Academic Structure.
 * Request/response contracts remain deferred until API Contract Freeze.
 */
export type AcademicStructureSkeletonDto = {
  readonly boundedContext: 'Academic Structure';
  readonly status: 'skeleton';
};

export const ACADEMIC_STRUCTURE_SKELETON_DTO: AcademicStructureSkeletonDto = {
  boundedContext: 'Academic Structure',
  status: 'skeleton',
};
