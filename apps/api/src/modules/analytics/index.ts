/**
 * Public API for the Analytics bounded context.
 * Other modules and composition roots may import only from this barrel.
 * Internal folders (application internals, domain, controllers, policies, placeholders)
 * are not part of the public contract.
 */
export { AnalyticsModule } from './analytics.module.js';
export { AnalyticsApplicationService } from './application/analytics.application-service.js';
export { AnalyticsEventNames } from './events/analytics.events.js';
export type { AnalyticsSkeletonRegisteredEvent } from './events/analytics.events.js';
export { ANALYTICS_SKELETON_DTO } from './dto/analytics.dto.js';
export type { AnalyticsSkeletonDto } from './dto/analytics.dto.js';
export { ANALYTICS_REPOSITORY } from './repositories/analytics.repository.js';
export type { AnalyticsRepository } from './repositories/analytics.repository.js';
