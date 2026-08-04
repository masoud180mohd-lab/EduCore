/**
 * OpenAI provider mapping + config (AI-006).
 */
import { describe, expect, it, vi } from 'vitest';

import { createAiGatewayServiceForTest } from '../application/ai-gateway.service.js';
import type { AiGatewayRepository } from '../repositories/ai-gateway.repository.js';
import { NotConfiguredAiProvider } from './not-configured-ai.provider.js';
import { mapOpenAiChatCompletion, OpenAiAiProvider } from './openai-ai.provider.js';
import { loadOpenAiConfig, reportOpenAiConfig } from './openai-config.js';

describe('openai-config', () => {
  it('loads config only when API key present', () => {
    expect(loadOpenAiConfig({})).toBeNull();
    const cfg = loadOpenAiConfig({
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: 'gpt-test',
    });
    expect(cfg?.apiKey).toBe('sk-test');
    expect(cfg?.model).toBe('gpt-test');
  });

  it('reports openai_unconfigured without silent Fake', () => {
    const report = reportOpenAiConfig({
      AI_PROVIDER: 'openai',
    });
    expect(report.effectiveProvider).toBe('openai_unconfigured');
    expect(report.secretsPresent).toBe(false);
  });
});

describe('mapOpenAiChatCompletion', () => {
  it('maps content and usage tokens', () => {
    const mapped = mapOpenAiChatCompletion({
      model: 'gpt-4o-mini-2024',
      choices: [{ message: { content: 'ECHO: hi' } }],
      usage: { prompt_tokens: 3, completion_tokens: 5 },
    });
    expect(mapped.providerCode).toBe('openai');
    expect(mapped.modelCode).toBe('gpt-4o-mini-2024');
    expect(mapped.outputText).toBe('ECHO: hi');
    expect(mapped.inputTokens).toBe(3);
    expect(mapped.outputTokens).toBe(5);
    expect(mapped.estimatedCostMinor).toBe(0);
  });
});

describe('OpenAiAiProvider', () => {
  it('calls chat completions with Bearer auth', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            model: 'gpt-4o-mini',
            choices: [{ message: { content: 'ok' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const provider = new OpenAiAiProvider(
      {
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.test',
        model: 'gpt-4o-mini',
      },
      fetchImpl,
    );
    const result = await provider.generate({
      renderedPrompt: 'ECHO: x',
      featureCode: 'lab.echo',
      correlationId: 'c1',
    });
    expect(result.outputText).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(0);
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe('https://api.openai.test/v1/chat/completions');
    expect(call[1].headers).toMatchObject({
      Authorization: 'Bearer sk-test',
    });
  });
});

describe('NotConfiguredAiProvider via gateway', () => {
  it('settles provider_not_configured without metering', async () => {
    const completeInvoke = vi.fn(() => Promise.resolve(undefined));
    const repo = {
      isAvailable: () => true,
      getActivePrompt: () =>
        Promise.resolve({
          id: '01900000-0003-7000-8000-000000000001',
          code: 'lab.echo',
          version: 1,
          locale: 'en',
          body: 'ECHO: {{message}}',
          status: 'active',
          allowlistPlaceholders: ['message'],
          createdAt: new Date().toISOString(),
        }),
      sumRequestCountForDate: () => Promise.resolve(0),
      completeInvoke,
    } as unknown as AiGatewayRepository;

    const prev = process.env['AI_PLATFORM_ENABLED'];
    const prevProvider = process.env['AI_PROVIDER'];
    process.env['AI_PLATFORM_ENABLED'] = 'true';
    process.env['AI_PROVIDER'] = 'fake';
    process.env['AI_BYPASS_DAILY_CAP'] = 'true';

    const gateway = createAiGatewayServiceForTest(repo, new NotConfiguredAiProvider('openai'));
    const result = await gateway.invoke({
      tenantId: '01900000-0000-7000-8000-000000000001',
      actorUserId: '01900000-0000-7000-8000-000000000002',
      featureCode: 'lab.echo',
      promptCode: 'lab.echo',
      locale: 'en',
      variables: { message: 'x' },
      correlationId: 'corr-openai-missing',
    });

    expect(result.status).toBe('failed');
    expect(result.rejectReason).toBe('provider_not_configured');
    expect(completeInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', countUsage: false }),
    );

    if (prev === undefined) delete process.env['AI_PLATFORM_ENABLED'];
    else process.env['AI_PLATFORM_ENABLED'] = prev;
    if (prevProvider === undefined) delete process.env['AI_PROVIDER'];
    else process.env['AI_PROVIDER'] = prevProvider;
  });
});
