/**
 * Public API for the AI Gateway bounded context (ADR-003).
 * Domain features must invoke AI only via AiGatewayPort / AiGatewayService.
 */
export { AiGatewayModule } from './ai-gateway.module.js';
export { AiGatewayService } from './application/ai-gateway.service.js';
export { AiLabService } from './application/ai-lab.service.js';
export { AI_GATEWAY_PORT, AI_PROVIDER_PORT } from './providers/ai-gateway.port.js';
export type {
  AiGatewayPort,
  AiInvokeCommand,
  AiInvokeResult,
  AiProviderPort,
} from './providers/ai-gateway.port.js';
export {
  RUNTIME_AI_FEATURE_ALLOWLIST,
  isRuntimeAiFeatureAllowed,
  isAiPlatformEnabled,
} from './application/ai-feature-gate.js';
export { AI_LAB_PROMPT_CATALOG, isKnownLabPromptCode } from './application/ai-prompt-catalog.js';
export type { AiLabPromptCatalogEntry } from './application/ai-prompt-catalog.js';
export {
  LAB_ECHO_EVAL_FIXTURES,
  runAiEvalFixture,
  runAiEvalSuite,
} from './eval/index.js';
export type {
  AiEvalCaseResult,
  AiEvalCategory,
  AiEvalFixture,
  AiEvalSuiteResult,
} from './eval/index.js';
