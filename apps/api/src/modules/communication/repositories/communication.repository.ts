/**
 * Persistence contract for Communication.
 * No database adapter is provided before Database Freeze.
 */
export interface CommunicationRepository {
  readonly boundedContext: 'Communication';
}

export const COMMUNICATION_REPOSITORY = Symbol('COMMUNICATION_REPOSITORY');
