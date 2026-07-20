import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { TenantSettingsController } from './tenant-settings.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('TenantSettingsController', () => {
  it('returns settings for authenticated principal with tenant context', async () => {
    const tenantSettingsService = {
      getForTenant: vi.fn().mockResolvedValue({
        data: { schemaVersion: 1, settings: {}, updatedAt: '2026-01-01T00:00:00.000Z' },
      }),
    };
    const controller = new TenantSettingsController(tenantSettingsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.get(request as never);
    expect(tenantSettingsService.getForTenant).toHaveBeenCalledWith(userId, tenantId);
    expect(result).toEqual({
      data: { schemaVersion: 1, settings: {}, updatedAt: '2026-01-01T00:00:00.000Z' },
    });
  });

  it('rejects get when auth context is missing', async () => {
    const tenantSettingsService = { getForTenant: vi.fn() };
    const controller = new TenantSettingsController(tenantSettingsService as never);
    const request = {
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await expect(controller.get(request as never)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(tenantSettingsService.getForTenant).not.toHaveBeenCalled();
  });

  it('rejects get when tenant context is missing', async () => {
    const tenantSettingsService = { getForTenant: vi.fn() };
    const controller = new TenantSettingsController(tenantSettingsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
    };
    await expect(controller.get(request as never)).rejects.toMatchObject({
      code: 'TENANT_CONTEXT_REQUIRED',
    });
    expect(tenantSettingsService.getForTenant).not.toHaveBeenCalled();
  });

  it('puts settings for authenticated principal with tenant context', async () => {
    const tenantSettingsService = {
      putForTenant: vi.fn().mockResolvedValue({
        data: {
          schemaVersion: 1,
          settings: { theme: 'dark' },
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      }),
    };
    const controller = new TenantSettingsController(tenantSettingsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const body = { schemaVersion: 1, settings: { theme: 'dark' } };
    const result = await controller.put(request as never, body, 'idem-key-abcdefghijkl');
    expect(tenantSettingsService.putForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      body,
      'idem-key-abcdefghijkl',
      'unknown',
    );
    expect(result).toEqual({
      data: {
        schemaVersion: 1,
        settings: { theme: 'dark' },
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    });
  });

  it('rejects put when auth context is missing', async () => {
    const tenantSettingsService = { putForTenant: vi.fn() };
    const controller = new TenantSettingsController(tenantSettingsService as never);
    await expect(
      controller.put({ [TENANT_CONTEXT_REQUEST_KEY]: { tenantId } } as never, {
        schemaVersion: 1,
        settings: {},
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(tenantSettingsService.putForTenant).not.toHaveBeenCalled();
  });

  it('documents get + put only (no patch/delete)', () => {
    const proto = TenantSettingsController.prototype as unknown as Record<string, unknown>;
    expect(typeof proto['get']).toBe('function');
    expect(typeof proto['put']).toBe('function');
    expect(proto['patch']).toBeUndefined();
    expect(proto['remove']).toBeUndefined();
    expect(proto['delete']).toBeUndefined();
  });
});
