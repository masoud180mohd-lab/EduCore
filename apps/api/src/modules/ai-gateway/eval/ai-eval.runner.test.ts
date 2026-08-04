/**
 * AI-005 eval harness suite (Fake only).
 */
import { describe, expect, it } from 'vitest';

import { runAiEvalFixture, runAiEvalSuite } from './ai-eval.runner.js';
import { LAB_ECHO_EVAL_FIXTURES } from './fixtures/lab-echo.fixtures.js';

describe('AI_EVAL_HARNESS (AI-005)', () => {
  it('runs the lab.echo baseline suite', async () => {
    const suite = await runAiEvalSuite(LAB_ECHO_EVAL_FIXTURES);
    if (!suite.passed) {
      const details = suite.results
        .filter((r) => !r.passed)
        .map((r) => `${r.id}: ${r.errors.join('; ')}`)
        .join('\n');
      expect.fail(`Eval suite failed (${String(suite.failed)}/${String(suite.total)}):\n${details}`);
    }
    expect(suite.total).toBe(LAB_ECHO_EVAL_FIXTURES.length);
    expect(suite.failed).toBe(0);
  });

  it('covers required categories for gate checklist #7', () => {
    const categories = new Set(LAB_ECHO_EVAL_FIXTURES.map((f) => f.category));
    expect(categories.has('happy')).toBe(true);
    expect(categories.has('failure')).toBe(true);
    expect(categories.has('redaction')).toBe(true);
  });

  it('reports failure details for a deliberately wrong expectation', async () => {
    const result = await runAiEvalFixture({
      ...LAB_ECHO_EVAL_FIXTURES[0]!,
      id: 'lab.echo.meta.wrong_expect',
      expect: {
        status: 'rejected',
        rejectReason: 'feature_blocked',
      },
    });
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.startsWith('status:'))).toBe(true);
  });
});
