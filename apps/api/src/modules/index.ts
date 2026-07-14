import { AcademicStructureModule } from './academic-structure/index.js';
import { AiInsightsModule } from './ai-insights/index.js';
import { AnalyticsModule } from './analytics/index.js';
import { AssessmentModule } from './assessment/index.js';
import { AttendanceModule } from './attendance/index.js';
import { CommunicationModule } from './communication/index.js';
import { DocumentsAndFilesModule } from './documents-and-files/index.js';
import { FinanceLedgerModule } from './finance-ledger/index.js';
import { IdentityAndAccessModule } from './identity-and-access/index.js';
import { IntegrationsModule } from './integrations/index.js';
import { PaymentsModule } from './payments/index.js';
import { PlatformOperationsModule } from './platform-operations/index.js';
import { StudentRegistryModule } from './student-registry/index.js';
import { TenantAndBillingModule } from './tenant-and-billing/index.js';

/**
 * Canonical bounded-context module registry for the modular monolith skeleton.
 * Imports use each context public barrel only.
 */
export const BOUNDED_CONTEXT_MODULES = [
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
] as const;

export const BOUNDED_CONTEXT_NAMES = [
  'Identity And Access',
  'Tenant And Billing',
  'Student Registry',
  'Academic Structure',
  'Attendance',
  'Assessment',
  'Finance Ledger',
  'Payments',
  'Communication',
  'Documents And Files',
  'AI Insights',
  'Integrations',
  'Analytics',
  'Platform Operations',
] as const;
