import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { ConfigModule } from './common/config/config.module.js';
import { CorrelationIdMiddleware } from './common/correlation/correlation-id.middleware.js';
import { HttpExceptionFilter } from './common/errors/http-exception.filter.js';
import { DOMAIN_EVENT_PUBLISHER, NoopDomainEventPublisher } from './common/events/domain-event.js';
import { HealthModule } from './common/health/health.module.js';
import type { AppLogger } from './common/logging/logger.js';
import { LoggerModule } from './common/logging/logger.module.js';
import { APP_LOGGER } from './common/logging/logger.tokens.js';
import { AcademicStructureModule } from './modules/academic-structure/index.js';
import { AiInsightsModule } from './modules/ai-insights/index.js';
import { AnalyticsModule } from './modules/analytics/index.js';
import { AssessmentModule } from './modules/assessment/index.js';
import { AttendanceModule } from './modules/attendance/index.js';
import { CommunicationModule } from './modules/communication/index.js';
import { DocumentsAndFilesModule } from './modules/documents-and-files/index.js';
import { FinanceLedgerModule } from './modules/finance-ledger/index.js';
import { IdentityAndAccessModule } from './modules/identity-and-access/index.js';
import { IntegrationsModule } from './modules/integrations/index.js';
import { PaymentsModule } from './modules/payments/index.js';
import { PlatformOperationsModule } from './modules/platform-operations/index.js';
import { StudentRegistryModule } from './modules/student-registry/index.js';
import { TenantAndBillingModule } from './modules/tenant-and-billing/index.js';

/**
 * Root modular-monolith composition.
 * Bounded contexts are registered via public barrels only (ADR-001 / PLAT-005).
 */
@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    HealthModule,
    IdentityAndAccessModule,
    TenantAndBillingModule,
    StudentRegistryModule,
    AcademicStructureModule,
    AttendanceModule,
    AssessmentModule,
    FinanceLedgerModule,
    PaymentsModule,
    CommunicationModule,
    DocumentsAndFilesModule,
    AiInsightsModule,
    IntegrationsModule,
    AnalyticsModule,
    PlatformOperationsModule,
  ],
  providers: [
    {
      provide: DOMAIN_EVENT_PUBLISHER,
      useClass: NoopDomainEventPublisher,
    },
    {
      provide: APP_FILTER,
      inject: [APP_LOGGER],
      useFactory: (logger: AppLogger) => new HttpExceptionFilter(logger),
    },
  ],
  exports: [DOMAIN_EVENT_PUBLISHER],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
