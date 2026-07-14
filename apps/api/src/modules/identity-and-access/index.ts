/**
 * Public API for the IdentityAndAccess bounded context.
 * Other modules and composition roots may import only from this barrel.
 * Internal folders (application internals, domain, controllers, policies, placeholders)
 * are not part of the public contract.
 */
export { IdentityAndAccessModule } from './identity-and-access.module.js';
export { IdentityAndAccessApplicationService } from './application/identity-and-access.application-service.js';
export { IdentityAndAccessEventNames } from './events/identity-and-access.events.js';
export type { IdentityAndAccessSkeletonRegisteredEvent } from './events/identity-and-access.events.js';
export { IDENTITY_AND_ACCESS_SKELETON_DTO } from './dto/identity-and-access.dto.js';
export type { IdentityAndAccessSkeletonDto } from './dto/identity-and-access.dto.js';
export { IDENTITY_AND_ACCESS_REPOSITORY } from './repositories/identity-and-access.repository.js';
export type { IdentityAndAccessRepository } from './repositories/identity-and-access.repository.js';
