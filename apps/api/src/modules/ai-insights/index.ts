/**
 * Public API for the AiInsights bounded context.
 * Other modules and composition roots may import only from this barrel.
 * Internal folders (application internals, domain, controllers, policies, placeholders)
 * are not part of the public contract.
 */
export { AiInsightsModule } from './ai-insights.module.js';
export { AiInsightsApplicationService } from './application/ai-insights.application-service.js';
export { AiInsightsEventNames } from './events/ai-insights.events.js';
export type { AiInsightsSkeletonRegisteredEvent } from './events/ai-insights.events.js';
export { AI_INSIGHTS_SKELETON_DTO } from './dto/ai-insights.dto.js';
export type { AiInsightsSkeletonDto } from './dto/ai-insights.dto.js';
export { AI_INSIGHTS_REPOSITORY } from './repositories/ai-insights.repository.js';
export type { AiInsightsRepository } from './repositories/ai-insights.repository.js';
