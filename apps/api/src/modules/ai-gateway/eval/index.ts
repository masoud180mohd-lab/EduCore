/**
 * Public exports for AI eval harness (AI-005).
 */
export { runAiEvalFixture, runAiEvalSuite } from './ai-eval.runner.js';
export type {
  AiEvalCaseResult,
  AiEvalCategory,
  AiEvalExpect,
  AiEvalFixture,
  AiEvalSuiteResult,
} from './ai-eval.types.js';
export { LAB_ECHO_EVAL_FIXTURES } from './fixtures/lab-echo.fixtures.js';
