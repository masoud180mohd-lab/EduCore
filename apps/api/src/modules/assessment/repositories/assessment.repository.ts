/**
 * Persistence contract for Assessment.
 * No database adapter is provided before Database Freeze.
 */
export interface AssessmentRepository {
  readonly boundedContext: 'Assessment';
}

export const ASSESSMENT_REPOSITORY = Symbol('ASSESSMENT_REPOSITORY');
