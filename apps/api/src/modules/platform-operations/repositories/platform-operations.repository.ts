/**
 * Persistence contract for Platform Operations.
 * No database adapter is provided before Database Freeze.
 */
export interface PlatformOperationsRepository {
  readonly boundedContext: 'Platform Operations';
}

export const PLATFORM_OPERATIONS_REPOSITORY = Symbol('PLATFORM_OPERATIONS_REPOSITORY');
