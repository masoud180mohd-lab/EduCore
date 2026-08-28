/**
 * Offline Fake-only AI eval runner (AI-005).
 */
import { createAiGatewayServiceForTest } from '../application/ai-gateway.service.js';
import { FakeAiProvider } from '../providers/fake-ai.provider.js';
import type { AiGatewayRepository } from '../repositories/ai-gateway.repository.js';
import type { AiEvalCaseResult, AiEvalFixture, AiEvalSuiteResult } from './ai-eval.types.js';

const DEFAULT_TENANT_ID = '01900000-0000-7000-8000-00000000e001';
const DEFAULT_ACTOR_USER_ID = '01900000-0000-7000-8000-00000000e002';

const DEFAULT_PROMPT = {
  id: '01900000-0003-7000-8000-000000000001',
  code: 'lab.echo',
  version: 1,
  locale: 'en',
  body: 'ECHO: {{message}}',
  status: 'active',
  allowlistPlaceholders: ['message'] as const,
  createdAt: '2026-08-03T00:00:00.000Z',
};

type CompleteInvokeCapture = {
  readonly status: string;
  readonly countUsage: boolean;
  readonly variablesRedacted: Readonly<Record<string, string>> | null;
};

export async function runAiEvalFixture(fixture: AiEvalFixture): Promise<AiEvalCaseResult> {
  const errors: string[] = [];
  const envKeys = Object.keys(fixture.env ?? {});
  const previousEnv: Record<string, string | undefined> = {};
  for (const key of envKeys) {
    previousEnv[key] = process.env[key];
  }

  try {
    applyEnv(fixture.env);

    const captures: CompleteInvokeCapture[] = [];
    const prompt = {
      ...DEFAULT_PROMPT,
      ...(fixture.prompt === undefined
        ? {}
        : {
            code: fixture.prompt.code ?? DEFAULT_PROMPT.code,
            version: fixture.prompt.version ?? DEFAULT_PROMPT.version,
            locale: fixture.prompt.locale ?? fixture.command.locale,
            body: fixture.prompt.body,
            allowlistPlaceholders: fixture.prompt.allowlistPlaceholders,
          }),
    };

    const repo = {
      isAvailable: () => true,
      getActivePrompt: () => Promise.resolve(prompt),
      sumRequestCountForDate: () => {
        if (fixture.meterUnavailable === true) {
          return Promise.reject(new Error('meter unavailable'));
        }
        return Promise.resolve(fixture.meterUsed ?? 0);
      },
      completeInvoke: (input: CompleteInvokeCapture) => {
        captures.push({
          status: input.status,
          countUsage: input.countUsage,
          variablesRedacted: input.variablesRedacted,
        });
        return Promise.resolve(undefined);
      },
    } as unknown as AiGatewayRepository;

    const gateway = createAiGatewayServiceForTest(repo, new FakeAiProvider());
    const result = await gateway.invoke({
      tenantId: DEFAULT_TENANT_ID,
      actorUserId: DEFAULT_ACTOR_USER_ID,
      featureCode: fixture.command.featureCode,
      promptCode: fixture.command.promptCode,
      locale: fixture.command.locale,
      variables: fixture.command.variables,
      correlationId: fixture.command.correlationId ?? `eval:${fixture.id}`,
    });

    if (result.status !== fixture.expect.status) {
      errors.push(`status: expected ${fixture.expect.status}, got ${result.status}`);
    }

    if (fixture.expect.rejectReason !== undefined) {
      const expected = fixture.expect.rejectReason;
      if (result.rejectReason !== expected) {
        errors.push(
          `rejectReason: expected ${String(expected)}, got ${String(result.rejectReason)}`,
        );
      }
    }

    if (fixture.expect.outputTextEquals !== undefined) {
      if (result.outputText !== fixture.expect.outputTextEquals) {
        errors.push(
          `outputTextEquals: expected ${JSON.stringify(fixture.expect.outputTextEquals)}, got ${JSON.stringify(result.outputText)}`,
        );
      }
    }

    if (fixture.expect.outputTextContains !== undefined) {
      const needle = fixture.expect.outputTextContains;
      if (result.outputText === null || !result.outputText.includes(needle)) {
        errors.push(`outputTextContains: missing ${JSON.stringify(needle)}`);
      }
    }

    if (fixture.expect.countUsage !== undefined) {
      const last = captures[captures.length - 1];
      if (last === undefined) {
        errors.push('countUsage: completeInvoke was not called');
      } else if (last.countUsage !== fixture.expect.countUsage) {
        errors.push(
          `countUsage: expected ${String(fixture.expect.countUsage)}, got ${String(last.countUsage)}`,
        );
      }
    }

    if (fixture.expect.redactedMessageMaxLen !== undefined) {
      const last = captures[captures.length - 1];
      const message = last?.variablesRedacted?.['message'];
      if (typeof message !== 'string') {
        errors.push('redactedMessageMaxLen: variablesRedacted.message missing');
      } else if (message.length > fixture.expect.redactedMessageMaxLen) {
        errors.push(
          `redactedMessageMaxLen: expected ≤ ${String(fixture.expect.redactedMessageMaxLen)}, got ${String(message.length)}`,
        );
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`runner error: ${message}`);
  } finally {
    restoreEnv(previousEnv);
  }

  return {
    id: fixture.id,
    category: fixture.category,
    passed: errors.length === 0,
    errors,
  };
}

export async function runAiEvalSuite(
  fixtures: ReadonlyArray<AiEvalFixture>,
): Promise<AiEvalSuiteResult> {
  const results: AiEvalCaseResult[] = [];
  for (const fixture of fixtures) {
    results.push(await runAiEvalFixture(fixture));
  }
  const failed = results.filter((r) => !r.passed).length;
  return {
    passed: failed === 0,
    total: results.length,
    failed,
    results,
  };
}

function applyEnv(env: AiEvalFixture['env']): void {
  if (env === undefined) return;
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function restoreEnv(previous: Readonly<Record<string, string | undefined>>): void {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
