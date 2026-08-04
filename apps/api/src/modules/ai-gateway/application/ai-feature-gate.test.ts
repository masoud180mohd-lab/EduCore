/**
 * AI feature gate helpers (AI-001 / AI-002).
 */
import { describe, expect, it } from 'vitest';

import {
  assertAiVariableAllowlist,
  isAiFeatureEnvDisabled,
  isAiPlatformEnabled,
  isRuntimeAiFeatureAllowed,
  redactForAi,
  renderAiPromptBody,
  resolveAiProviderName,
  aiDailyCapFromEnv,
} from './ai-feature-gate.js';

describe('ai-feature-gate', () => {
  it('allows only lab.echo at runtime', () => {
    expect(isRuntimeAiFeatureAllowed('lab.echo')).toBe(true);
    expect(isRuntimeAiFeatureAllowed('report.draft')).toBe(false);
  });

  it('reads platform kill switch', () => {
    const prev = process.env['AI_PLATFORM_ENABLED'];
    process.env['AI_PLATFORM_ENABLED'] = 'false';
    expect(isAiPlatformEnabled()).toBe(false);
    process.env['AI_PLATFORM_ENABLED'] = 'true';
    expect(isAiPlatformEnabled()).toBe(true);
    if (prev === undefined) delete process.env['AI_PLATFORM_ENABLED'];
    else process.env['AI_PLATFORM_ENABLED'] = prev;
  });

  it('resolves provider name', () => {
    const prev = process.env['AI_PROVIDER'];
    process.env['AI_PROVIDER'] = 'disabled';
    expect(resolveAiProviderName()).toBe('disabled');
    process.env['AI_PROVIDER'] = 'fake';
    expect(resolveAiProviderName()).toBe('fake');
    process.env['AI_PROVIDER'] = 'openai';
    expect(resolveAiProviderName()).toBe('openai');
    if (prev === undefined) delete process.env['AI_PROVIDER'];
    else process.env['AI_PROVIDER'] = prev;
  });

  it('honours per-feature disable list', () => {
    const prev = process.env['AI_FEATURE_DISABLED'];
    process.env['AI_FEATURE_DISABLED'] = 'lab.echo,other';
    expect(isAiFeatureEnvDisabled('lab.echo')).toBe(true);
    expect(isAiFeatureEnvDisabled('other')).toBe(true);
    expect(isAiFeatureEnvDisabled('x')).toBe(false);
    if (prev === undefined) delete process.env['AI_FEATURE_DISABLED'];
    else process.env['AI_FEATURE_DISABLED'] = prev;
  });

  it('renders placeholders and rejects unknown keys', () => {
    expect(renderAiPromptBody('ECHO: {{message}}', { message: 'hi' })).toBe('ECHO: hi');
    expect(() => assertAiVariableAllowlist(['message'], { message: 'a', secret: 'b' })).toThrow(
      /Unknown placeholder/,
    );
  });

  it('redacts long values', () => {
    const long = 'x'.repeat(600);
    expect(redactForAi({ message: long })['message']?.endsWith('…')).toBe(true);
  });

  it('reads daily cap and bypass', () => {
    const prevCap = process.env['AI_DAILY_CAP_PER_TENANT'];
    const prevBypass = process.env['AI_BYPASS_DAILY_CAP'];
    delete process.env['AI_BYPASS_DAILY_CAP'];
    process.env['AI_DAILY_CAP_PER_TENANT'] = '12';
    expect(aiDailyCapFromEnv()).toBe(12);
    process.env['AI_BYPASS_DAILY_CAP'] = 'true';
    expect(aiDailyCapFromEnv()).toBe(-1);
    if (prevCap === undefined) delete process.env['AI_DAILY_CAP_PER_TENANT'];
    else process.env['AI_DAILY_CAP_PER_TENANT'] = prevCap;
    if (prevBypass === undefined) delete process.env['AI_BYPASS_DAILY_CAP'];
    else process.env['AI_BYPASS_DAILY_CAP'] = prevBypass;
  });
});
