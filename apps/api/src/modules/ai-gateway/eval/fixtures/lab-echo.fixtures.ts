/**
 * Baseline Fake eval fixtures for lab.echo (AI-005).
 */
import type { AiEvalFixture } from '../ai-eval.types.js';

const LONG_MESSAGE = `${'x'.repeat(600)}`;

export const LAB_ECHO_EVAL_FIXTURES: ReadonlyArray<AiEvalFixture> = [
  {
    id: 'lab.echo.happy.en',
    category: 'happy',
    description: 'Fake echo succeeds and meters usage',
    env: {
      AI_PLATFORM_ENABLED: 'true',
      AI_PROVIDER: 'fake',
      AI_BYPASS_DAILY_CAP: 'true',
      AI_FEATURE_DISABLED: undefined,
    },
    command: {
      featureCode: 'lab.echo',
      promptCode: 'lab.echo',
      locale: 'en',
      variables: { message: 'karibu' },
    },
    expect: {
      status: 'succeeded',
      rejectReason: null,
      outputTextEquals: 'ECHO: karibu',
      countUsage: true,
    },
  },
  {
    id: 'lab.echo.gate.blocked',
    category: 'gate',
    description: 'Non-allowlisted featureCode is rejected',
    env: {
      AI_PLATFORM_ENABLED: 'true',
      AI_PROVIDER: 'fake',
      AI_BYPASS_DAILY_CAP: 'true',
    },
    command: {
      featureCode: 'report.draft',
      promptCode: 'lab.echo',
      locale: 'en',
      variables: { message: 'x' },
    },
    expect: {
      status: 'rejected',
      rejectReason: 'feature_blocked',
      outputTextEquals: null,
      countUsage: false,
    },
  },
  {
    id: 'lab.echo.kill_switch',
    category: 'kill_switch',
    description: 'Platform kill switch returns disabled without metering',
    env: {
      AI_PLATFORM_ENABLED: 'false',
      AI_PROVIDER: 'fake',
    },
    command: {
      featureCode: 'lab.echo',
      promptCode: 'lab.echo',
      locale: 'en',
      variables: { message: 'x' },
    },
    expect: {
      status: 'disabled',
      rejectReason: 'platform_disabled',
      outputTextEquals: null,
      countUsage: false,
    },
  },
  {
    id: 'lab.echo.cap.exhausted',
    category: 'cap',
    description: 'Daily cap rejects before Fake provider',
    env: {
      AI_PLATFORM_ENABLED: 'true',
      AI_PROVIDER: 'fake',
      AI_DAILY_CAP_PER_TENANT: '100',
      AI_BYPASS_DAILY_CAP: undefined,
    },
    meterUsed: 100,
    command: {
      featureCode: 'lab.echo',
      promptCode: 'lab.echo',
      locale: 'en',
      variables: { message: 'x' },
    },
    expect: {
      status: 'rejected',
      rejectReason: 'daily_cap',
      outputTextEquals: null,
      countUsage: false,
    },
  },
  {
    id: 'lab.echo.failure.unknown_variable',
    category: 'failure',
    description: 'Unknown placeholder is rejected',
    env: {
      AI_PLATFORM_ENABLED: 'true',
      AI_PROVIDER: 'fake',
      AI_BYPASS_DAILY_CAP: 'true',
    },
    command: {
      featureCode: 'lab.echo',
      promptCode: 'lab.echo',
      locale: 'en',
      variables: { message: 'ok', secret: 'nope' },
    },
    expect: {
      status: 'rejected',
      rejectReason: 'unknown_variable',
      outputTextEquals: null,
      countUsage: false,
    },
  },
  {
    id: 'lab.echo.redaction.long_message',
    category: 'redaction',
    description: 'Long variable values are truncated by redactForAi before Fake',
    env: {
      AI_PLATFORM_ENABLED: 'true',
      AI_PROVIDER: 'fake',
      AI_BYPASS_DAILY_CAP: 'true',
    },
    command: {
      featureCode: 'lab.echo',
      promptCode: 'lab.echo',
      locale: 'en',
      variables: { message: LONG_MESSAGE },
    },
    expect: {
      status: 'succeeded',
      rejectReason: null,
      outputTextContains: 'ECHO: ',
      countUsage: true,
      redactedMessageMaxLen: 501,
    },
  },
  {
    id: 'lab.echo.failure.meter_unavailable',
    category: 'failure',
    description: 'Meter read failure fails closed (no success meter)',
    env: {
      AI_PLATFORM_ENABLED: 'true',
      AI_PROVIDER: 'fake',
      AI_DAILY_CAP_PER_TENANT: '100',
      AI_BYPASS_DAILY_CAP: undefined,
    },
    meterUnavailable: true,
    command: {
      featureCode: 'lab.echo',
      promptCode: 'lab.echo',
      locale: 'en',
      variables: { message: 'x' },
    },
    expect: {
      status: 'failed',
      rejectReason: 'meter_unavailable',
      outputTextEquals: null,
      countUsage: false,
    },
  },
];
