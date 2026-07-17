import { describe, expect, it, vi } from 'vitest';

import { TenantSettingsService } from './tenant-settings.service.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const settingsDoc = {
  schemaVersion: 1,
  settings: { theme: 'light' },
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('TenantSettingsService.getForTenant', () => {
  it('returns settings when present', async () => {
    const tenantSettings = {
      isAvailable: () => true,
      getForTenant: vi.fn().mockResolvedValue(settingsDoc),
    };
    const service = new TenantSettingsService(tenantSettings as never);
    await expect(service.getForTenant(userId, tenantId)).resolves.toEqual({
      data: settingsDoc,
    });
    expect(tenantSettings.getForTenant).toHaveBeenCalledWith(userId, tenantId);
  });

  it('returns NOT_FOUND when repository yields null', async () => {
    const tenantSettings = {
      isAvailable: () => true,
      getForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new TenantSettingsService(tenantSettings as never);
    await expect(service.getForTenant(userId, tenantId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('returns NOT_FOUND when pool is unavailable', async () => {
    const tenantSettings = {
      isAvailable: () => false,
      getForTenant: vi.fn(),
    };
    const service = new TenantSettingsService(tenantSettings as never);
    await expect(service.getForTenant(userId, tenantId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(tenantSettings.getForTenant).not.toHaveBeenCalled();
  });

  it('rejects non-uuid user ids', async () => {
    const tenantSettings = {
      isAvailable: () => true,
      getForTenant: vi.fn(),
    };
    const service = new TenantSettingsService(tenantSettings as never);
    await expect(service.getForTenant('bad', tenantId)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
