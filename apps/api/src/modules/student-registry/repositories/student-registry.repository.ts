/**
 * Persistence contract for Student Registry.
 * No database adapter is provided before Database Freeze.
 */
export interface StudentRegistryRepository {
  readonly boundedContext: 'Student Registry';
}

export const STUDENT_REGISTRY_REPOSITORY = Symbol('STUDENT_REGISTRY_REPOSITORY');
