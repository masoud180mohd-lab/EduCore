/**
 * Public API for the Communication bounded context.
 * Other modules and composition roots may import only from this barrel.
 * Internal folders (application internals, domain, controllers, policies, placeholders)
 * are not part of the public contract.
 */
export { CommunicationModule } from './communication.module.js';
export { CommunicationApplicationService } from './application/communication.application-service.js';
export { CommunicationEventNames } from './events/communication.events.js';
export type { CommunicationSkeletonRegisteredEvent } from './events/communication.events.js';
export { COMMUNICATION_SKELETON_DTO } from './dto/communication.dto.js';
export type { CommunicationSkeletonDto } from './dto/communication.dto.js';
export { COMMUNICATION_REPOSITORY } from './repositories/communication.repository.js';
export type { CommunicationRepository } from './repositories/communication.repository.js';
