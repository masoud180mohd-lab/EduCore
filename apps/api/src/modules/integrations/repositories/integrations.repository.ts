/**
 * Persistence contract for Integrations.
 * No database adapter is provided before Database Freeze.
 */
export interface IntegrationsRepository {
  readonly boundedContext: 'Integrations';
}

export const INTEGRATIONS_REPOSITORY = Symbol('INTEGRATIONS_REPOSITORY');
