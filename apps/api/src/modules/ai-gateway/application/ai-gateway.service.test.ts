/**
 * Fake AI provider + gateway pipeline (AI-002 / AI-004 metering).
 */
import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../common/errors/app-error.js';
import { createAiGatewayServiceForTest } from './ai-gateway.service.js';
import { AiLabService } from './ai-lab.service.js';
import { FakeAiProvider } from '../providers/fake-ai.provider.js';
import type { AiGatewayRepository } from '../repositories/ai-gateway.repository.js';

function mockRepo(overrides: Partial<AiGatewayRepository> = {}): AiGatewayRepository {
  return {
    isAvailable: () => true,
    listActivePrompts: vi.fn(),
    listPrompts: vi.fn(),
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
  it('echoes rendered prompt with deterministic token/cost estimates', async () => {
    const fake = new FakeAiProvider();
    const result = await fake.generate({
      renderedPrompt: 'ECHO: hello',
      featureCode: 'lab.echo',
      correlationId: 'c1',
    });
    expect(result.providerCode).toBe('fake');
    expect(result.modelCode).toBe('fake-echo-v1');
    expect(result.outputText).toBe('ECHO: hello');
    expect(result.inputTokens).toBe(Math.max(1, Math.ceil('ECHO: hello'.length / 4)));
    expect(result.outputTokens).toBe(result.inputTokens);
    expect(result.estimatedCostMinor).toBe(0);
  });
});

describe('AiGatewayService', () => {
  const tenantId = '01900000-0000-7000-8000-000000000001';
  const actorUserId = '01900000-0000-7000-8000-000000000002';

  it('succeeds on Fake lab.echo path and meters with tokens', async () => {
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
    expect(result.usage?.estimatedCostMinor).toBe(0);
    expect(result.usage?.inputTokens).toBeGreaterThan(0);
    expect(completeInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'succeeded',
        countUsage: true,
        featureCode: 'lab.echo',
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        estimatedCostMinor: 0,
      }),
    );

    if (prev === undefined) delete process.env['AI_PLATFORM_ENABLED'];
    else process.env['AI_PLATFORM_ENABLED'] = prev;
  });

  it('returns disabled when platform kill switch is off without success meter', async () => {
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

  it('rejects unknown feature codes without metering', async () => {
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
    expect(completeInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ countUsage: false, rejectReason: 'feature_blocked' }),
    );
  });

  it('rejects when daily cap is exhausted without metering', async () => {
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
    expect(completeInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ countUsage: false, rejectReason: 'daily_cap' }),
    );

    if (prevCap === undefined) delete process.env['AI_DAILY_CAP_PER_TENANT'];
    else process.env['AI_DAILY_CAP_PER_TENANT'] = prevCap;
    if (prevBypass === undefined) delete process.env['AI_BYPASS_DAILY_CAP'];
    else process.env['AI_BYPASS_DAILY_CAP'] = prevBypass;
  });

  it('bypasses cap but still meters successful invokes', async () => {
    const completeInvoke = vi.fn(() => Promise.resolve(undefined));
    const sumRequestCountForDate = vi.fn(() => Promise.resolve(10_000));
    const service = createAiGatewayServiceForTest(
      mockRepo({ completeInvoke, sumRequestCountForDate }),
      new FakeAiProvider(),
    );
    const prevCap = process.env['AI_DAILY_CAP_PER_TENANT'];
    const prevBypass = process.env['AI_BYPASS_DAILY_CAP'];
    process.env['AI_PLATFORM_ENABLED'] = 'true';
    process.env['AI_PROVIDER'] = 'fake';
    process.env['AI_DAILY_CAP_PER_TENANT'] = '1';
    process.env['AI_BYPASS_DAILY_CAP'] = 'true';

    const result = await service.invoke({
      tenantId,
      actorUserId,
      featureCode: 'lab.echo',
      promptCode: 'lab.echo',
      locale: 'en',
      variables: { message: 'bypass' },
      correlationId: 'corr-bypass',
    });

    expect(result.status).toBe('succeeded');
    expect(sumRequestCountForDate).not.toHaveBeenCalled();
    expect(completeInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded', countUsage: true }),
    );

    if (prevCap === undefined) delete process.env['AI_DAILY_CAP_PER_TENANT'];
    else process.env['AI_DAILY_CAP_PER_TENANT'] = prevCap;
    if (prevBypass === undefined) delete process.env['AI_BYPASS_DAILY_CAP'];
    else process.env['AI_BYPASS_DAILY_CAP'] = prevBypass;
  });

  it('fails closed when meter read throws', async () => {
    const completeInvoke = vi.fn(() => Promise.resolve(undefined));
    const service = createAiGatewayServiceForTest(
      mockRepo({
        completeInvoke,
        sumRequestCountForDate: vi.fn(() => Promise.reject(new Error('db down'))),
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
      correlationId: 'corr-meter',
    });

    expect(result.status).toBe('failed');
    expect(result.rejectReason).toBe('meter_unavailable');
    expect(completeInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ countUsage: false, rejectReason: 'meter_unavailable' }),
    );

    if (prevCap === undefined) delete process.env['AI_DAILY_CAP_PER_TENANT'];
    else process.env['AI_DAILY_CAP_PER_TENANT'] = prevCap;
    if (prevBypass === undefined) delete process.env['AI_BYPASS_DAILY_CAP'];
    else process.env['AI_BYPASS_DAILY_CAP'] = prevBypass;
  });
});

describe('AiLabService usage + cap HTTP mapping', () => {
  const actorUserId = '01900000-0000-7000-8000-000000000002';
  const tenantId = '01900000-0000-7000-8000-000000000001';

  it('aggregates usage totals and reports bypass flags', async () => {
    const prevBypass = process.env['AI_BYPASS_DAILY_CAP'];
    process.env['AI_BYPASS_DAILY_CAP'] = 'true';
    const listUsageDaily = vi.fn(() =>
      Promise.resolve([
        {
          usageDate: '2026-08-03',
          featureCode: 'lab.echo',
          requestCount: 2,
          inputTokens: 10,
          outputTokens: 12,
          estimatedCostMinor: 0,
        },
      ]),
    );
    const repo = {
      isAvailable: () => true,
      listUsageDaily,
    } as unknown as AiGatewayRepository;
    const service = new AiLabService({} as never, repo);
    const result = await service.getUsageForTenant(actorUserId, tenantId, '2026-08-03', undefined);
    expect(result.data.requestCountTotal).toBe(2);
    expect(result.data.inputTokensTotal).toBe(10);
    expect(result.data.outputTokensTotal).toBe(12);
    expect(result.data.estimatedCostMinorTotal).toBe(0);
    expect(result.data.bypassDailyCap).toBe(true);
    expect(result.data.dailyCap).toBeNull();
    expect(result.data.platformEnabled).toBeTypeOf('boolean');
    if (prevBypass === undefined) delete process.env['AI_BYPASS_DAILY_CAP'];
    else process.env['AI_BYPASS_DAILY_CAP'] = prevBypass;
  });

  it('filters usage by featureCode and rejects bad dates', async () => {
    const listUsageDaily = vi.fn(() => Promise.resolve([]));
    const repo = {
      isAvailable: () => true,
      listUsageDaily,
    } as unknown as AiGatewayRepository;
    const service = new AiLabService({} as never, repo);
    await service.getUsageForTenant(actorUserId, tenantId, '2026-08-03', 'lab.echo');
    expect(listUsageDaily).toHaveBeenCalledWith(actorUserId, tenantId, '2026-08-03', 'lab.echo');
    await expect(
      service.getUsageForTenant(actorUserId, tenantId, '2026-02-31', undefined),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      service.getUsageForTenant(actorUserId, tenantId, 'not-a-date', undefined),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('maps daily_cap reject to HTTP 409', async () => {
    const gateway = {
      invoke: vi.fn(() =>
        Promise.resolve({
          requestId: '01900000-0003-7000-8000-000000000099',
          status: 'rejected',
          outputText: null,
          modelCode: null,
          usage: null,
          rejectReason: 'daily_cap',
          providerCode: 'fake',
        }),
      ),
    };
    const service = new AiLabService(gateway as never, mockRepo());
    await expect(
      service.labInvokeForTenant(
        actorUserId,
        tenantId,
        {
          featureCode: 'lab.echo',
          promptCode: 'lab.echo',
          locale: 'en',
          variables: { message: 'x' },
        },
        'corr',
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
  });
});
