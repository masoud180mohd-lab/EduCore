/**
 * AI eval harness types (AI-005 / AI_EVAL_HARNESS).
 */

export type AiEvalCategory = 'happy' | 'failure' | 'redaction' | 'gate' | 'kill_switch' | 'cap';

export type AiEvalPromptOverride = {
  readonly code?: string;
  readonly version?: number;
  readonly locale?: string;
  readonly body: string;
  readonly allowlistPlaceholders: ReadonlyArray<string>;
};

export type AiEvalExpect = {
  readonly status: 'succeeded' | 'failed' | 'rejected' | 'disabled';
  readonly rejectReason?: string | null;
  readonly outputTextEquals?: string | null;
  readonly outputTextContains?: string;
  readonly countUsage?: boolean;
  /** When set, assert redacted variables_redacted.message length ≤ this (incl. ellipsis). */
  readonly redactedMessageMaxLen?: number;
};

export type AiEvalFixture = {
  readonly id: string;
  readonly category: AiEvalCategory;
  readonly description: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly command: {
    readonly featureCode: string;
    readonly promptCode: string;
    readonly locale: string;
    readonly variables: Readonly<Record<string, string>>;
    readonly correlationId?: string;
  };
  readonly prompt?: AiEvalPromptOverride;
  readonly meterUsed?: number;
  /** When true, meter read throws (fail-closed path). */
  readonly meterUnavailable?: boolean;
  readonly expect: AiEvalExpect;
};

export type AiEvalCaseResult = {
  readonly id: string;
  readonly category: AiEvalCategory;
  readonly passed: boolean;
  readonly errors: ReadonlyArray<string>;
};

export type AiEvalSuiteResult = {
  readonly passed: boolean;
  readonly total: number;
  readonly failed: number;
  readonly results: ReadonlyArray<AiEvalCaseResult>;
};
