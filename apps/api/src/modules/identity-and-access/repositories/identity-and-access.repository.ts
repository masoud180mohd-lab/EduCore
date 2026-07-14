/**
 * Persistence contract for Identity And Access.
 * No database adapter is provided before Database Freeze.
 */
export interface IdentityAndAccessRepository {
  readonly boundedContext: 'Identity And Access';
}

export const IDENTITY_AND_ACCESS_REPOSITORY = Symbol('IDENTITY_AND_ACCESS_REPOSITORY');
