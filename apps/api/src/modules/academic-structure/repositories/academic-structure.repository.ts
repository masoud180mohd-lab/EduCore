/**
 * Persistence contract for Academic Structure.
 * No database adapter is provided before Database Freeze.
 */
export interface AcademicStructureRepository {
  readonly boundedContext: 'Academic Structure';
}

export const ACADEMIC_STRUCTURE_REPOSITORY = Symbol('ACADEMIC_STRUCTURE_REPOSITORY');
