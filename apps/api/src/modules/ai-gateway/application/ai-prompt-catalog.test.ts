/**
 * AI-003 prompt catalog + list query parsing.
 */
import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../common/errors/app-error.js';
import { AI_LAB_PROMPT_CATALOG, isKnownLabPromptCode } from './ai-prompt-catalog.js';
import { AiLabService } from './ai-lab.service.js';
import type { AiGatewayService } from './ai-gateway.service.js';
import type { AiGatewayRepository } from '../repositories/ai-gateway.repository.js';

describe('ai-prompt-catalog', () => {
  it('documents lab.echo with message placeholder', () => {
    expect(isKnownLabPromptCode('lab.echo')).toBe(true);
    expect(isKnownLabPromptCode('report.draft')).toBe(false);
    const echo = AI_LAB_PROMPT_CATALOG.find((e) => e.code === 'lab.echo');
    expect(echo?.allowlistPlaceholders).toEqual(['message']);
    expect(echo?.locales).toEqual(['en', 'sw']);
  });
});

describe('AiLabService listPromptsForTenant', () => {
  const actorUserId = '01900000-0000-7000-8000-000000000002';
  const tenantId = '01900000-0000-7000-8000-000000000001';

  it('returns catalog meta when store unavailable', async () => {
    const repo = {
      isAvailable: () => false,
      listPrompts: vi.fn(() => Promise.resolve([])),
    } as unknown as AiGatewayRepository;
    const service = new AiLabService({} as AiGatewayService, repo);
    const result = await service.listPromptsForTenant(actorUserId, tenantId);
    expect(result.data).toEqual([]);
    expect(result.meta.catalog.some((c) => c.code === 'lab.echo')).toBe(true);
  });

  it('rejects invalid locale filter', async () => {
    const repo = {
      isAvailable: () => true,
      listPrompts: vi.fn(() => Promise.resolve([])),
    } as unknown as AiGatewayRepository;
    const service = new AiLabService({} as AiGatewayService, repo);
    await expect(
      service.listPromptsForTenant(actorUserId, tenantId, { locale: 'fr' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('passes includeRetired and code filters to repository', async () => {
    const listPrompts = vi.fn(() => Promise.resolve([]));
    const repo = {
      isAvailable: () => true,
      listPrompts,
    } as unknown as AiGatewayRepository;
    const service = new AiLabService({} as AiGatewayService, repo);
    await service.listPromptsForTenant(actorUserId, tenantId, {
      code: 'lab.echo',
      locale: 'en',
      includeRetired: 'true',
    });
    expect(listPrompts).toHaveBeenCalledWith(actorUserId, tenantId, {
      code: 'lab.echo',
      locale: 'en',
      includeRetired: true,
    });
  });
});
