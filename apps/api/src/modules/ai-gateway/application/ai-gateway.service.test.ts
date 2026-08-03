/**
 * Fake AI provider + gateway pipeline (AI-002).
 */
import { describe, expect, it, vi } from 'vitest';

import { createAiGatewayServiceForTest } from './ai-gateway.service.js';
import { FakeAiProvider } from '../providers/fake-ai.provider.js';
import type { AiGatewayRepository } from '../repositories/ai-gateway.repository.js';

function mockRepo(overrides: Partial<AiGatewayRepository> = {}): AiGatewayRepository {
  return {
    isAvailable: () => true,
    listActivePrompts: vi.fn(),
    getActivePrompt: vi.fn(() =>
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
    ),
    getInvokeRequest: vi.fn(),
    listUsageDaily: vi.fn(),
    sumRequestCountForDate: vi.fn(() => Promise.resolve(0)),
    completeInvoke: vi.fn(() => Promise.resolve(undefined)),
    ...overrides,
  } as unknown as AiGatewayRepository;
}

describe('FakeAiProvider', () => {
  it('echoes rendered prompt with fake model code', async () => {
    const fake = new FakeAiProvider();
    const result = await fake.generate({
      renderedPrompt: 'ECHO: hello',
      featureCode: 'lab.echo',
      correlationId: 'c1',
    });
    expect(result.providerCode).toBe('fake');
    expect(result.modelCode).toBe('fake-echo-v1');
    expect(result.outputText).toBe('ECHO: hello');
    expect(result.estimatedCostMinor).toBe(0);
  });
});

describe('AiGatewayService', () => {
  const tenantId = '01900000-0000-7000-8000-000000000001';
  const actorUserId = '01900000-0000-7000-8000-000000000002';

  it('succeeds on Fake lab.echo path and meters', async () => {
    const completeInvoke = vi.fn(() => Promise.resolve(undefined));
    const service = createAiGatewayServiceForTest(
      mockRepo({ completeInvoke }),
      new FakeAiProvider(),
    );
    const prev = process.env['AI_PLATFORM_ENABLED'];
    process.env['AI_PLATFORM_ENABLED'] = 'true';
    process.env['AI_PROVIDER'] = 'fake';
    delete process.env['AI_FEATURE_DISABLED'];
    process.env['AI_BYPASS_DAILY_CAP'] = 'true';

    const result = await service.invoke({
      tenantId,
      actorUserId,
      featureCode: 'lab.echo',
      promptCode: 'lab.echo',
      locale: 'en',
      variables: { message: 'karibu' },
      correlationId: 'corr-1',
    });

    expect(result.status).toBe('succeeded');
    expect(result.outputText).toBe('ECHO: karibu');
    expect(result.modelCode).toBe('fake-echo-v1');
    expect(completeInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'succeeded',
        countUsage: true,
        featureCode: 'lab.echo',
      }),
    );

    if (prev === undefined) delete process.env['AI_PLATFORM_ENABLED'];
    else process.env['AI_PLATFORM_ENABLED'] = prev;
  });

  it('returns disabled when platform kill switch is off', async () => {
    const completeInvoke = vi.fn(() => Promise.resolve(undefined));
    const service = createAiGatewayServiceForTest(
      mockRepo({ completeInvoke }),
      new FakeAiProvider(),
    );
    const prev = process.env['AI_PLATFORM_ENABLED'];
    process.env['AI_PLATFORM_ENABLED'] = 'false';

    const result = await service.invoke({
      tenantId,
      actorUserId,
      featureCode: 'lab.echo',
      promptCode: 'lab.echo',
      locale: 'en',
      variables: { message: 'x' },
      correlationId: 'corr-2',
    });

    expect(result.status).toBe('disabled');
    expect(result.rejectReason).toBe('platform_disabled');
    expect(result.outputText).toBeNull();
    expect(completeInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'disabled', countUsage: false }),
    );

    if (prev === undefined) delete process.env['AI_PLATFORM_ENABLED'];
    else process.env['AI_PLATFORM_ENABLED'] = prev;
  });

  it('rejects unknown feature codes', async () => {
    const completeInvoke = vi.fn(() => Promise.resolve(undefined));
    const service = createAiGatewayServiceForTest(
      mockRepo({ completeInvoke }),
      new FakeAiProvider(),
    );
    process.env['AI_PLATFORM_ENABLED'] = 'true';
    process.env['AI_PROVIDER'] = 'fake';

    const result = await service.invoke({
      tenantId,
      actorUserId,
      featureCode: 'report.draft',
      promptCode: 'lab.echo',
      locale: 'en',
      variables: {},
      correlationId: 'corr-3',
    });

    expect(result.status).toBe('rejected');
    expect(result.rejectReason).toBe('feature_blocked');
  });

  it('rejects when daily cap is exhausted', async () => {
    const completeInvoke = vi.fn(() => Promise.resolve(undefined));
    const service = createAiGatewayServiceForTest(
      mockRepo({
        completeInvoke,
        sumRequestCountForDate: vi.fn(() => Promise.resolve(100)),
      }),
      new FakeAiProvider(),
    );
    const prevCap = process.env['AI_DAILY_CAP_PER_TENANT'];
    const prevBypass = process.env['AI_BYPASS_DAILY_CAP'];
    process.env['AI_PLATFORM_ENABLED'] = 'true';
    process.env['AI_PROVIDER'] = 'fake';
    process.env['AI_DAILY_CAP_PER_TENANT'] = '100';
    delete process.env['AI_BYPASS_DAILY_CAP'];

    const result = await service.invoke({
      tenantId,
      actorUserId,
      featureCode: 'lab.echo',
      promptCode: 'lab.echo',
      locale: 'en',
      variables: { message: 'x' },
      correlationId: 'corr-4',
    });

    expect(result.status).toBe('rejected');
    expect(result.rejectReason).toBe('daily_cap');

    if (prevCap === undefined) delete process.env['AI_DAILY_CAP_PER_TENANT'];
    else process.env['AI_DAILY_CAP_PER_TENANT'] = prevCap;
    if (prevBypass === undefined) delete process.env['AI_BYPASS_DAILY_CAP'];
    else process.env['AI_BYPASS_DAILY_CAP'] = prevBypass;
  });
});
