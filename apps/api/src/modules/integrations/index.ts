/**
 * Public API for the Integrations bounded context.
 * Other modules and composition roots may import only from this barrel.
 * Internal folders (application internals, domain, controllers, policies, placeholders)
 * are not part of the public contract.
 */
export { IntegrationsModule } from './integrations.module.js';
export { IntegrationsApplicationService } from './application/integrations.application-service.js';
export { IntegrationsEventNames } from './events/integrations.events.js';
export type { IntegrationsSkeletonRegisteredEvent } from './events/integrations.events.js';
export { INTEGRATIONS_SKELETON_DTO } from './dto/integrations.dto.js';
export type { IntegrationsSkeletonDto } from './dto/integrations.dto.js';
