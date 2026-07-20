import { describe, expect, it, vi } from 'vitest';

import { InMemoryIdempotencyStore } from '../../../common/idempotency/index.js';
import { InMemoryAuditPublisher } from '../../platform-operations/index.js';
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

describe('TenantSettingsService.putForTenant', () => {
  const corr = 'corr-1';

  it('upserts settings, returns envelope, and audits success', async () => {
    const tenantSettings = {
      isAvailable: () => true,
      replaceForTenant: vi.fn().mockResolvedValue(settingsDoc),
    };
    const audit = new InMemoryAuditPublisher();
    const service = new TenantSettingsService(tenantSettings as never, null, audit);
    await expect(
      service.putForTenant(
        userId,
        tenantId,
        { schemaVersion: 1, settings: { theme: 'light' } },
        undefined,
        corr,
      ),
    ).resolves.toEqual({ data: settingsDoc });
    expect(tenantSettings.replaceForTenant).toHaveBeenCalledWith(userId, tenantId, 1, {
      theme: 'light',
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: 'tenant_settings.put',
      outcome: 'success',
      correlationId: corr,
      resourceId: tenantId,
      metadata: { schemaVersion: 1 },
    });
  });

  it('rejects unknown top-level body keys', async () => {
    const tenantSettings = { isAvailable: () => true, replaceForTenant: vi.fn() };
    const service = new TenantSettingsService(tenantSettings as never);
    await expect(
      service.putForTenant(
        userId,
        tenantId,
        { schemaVersion: 1, settings: {}, extra: true },
        undefined,
        corr,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(tenantSettings.replaceForTenant).not.toHaveBeenCalled();
  });

  it('rejects non-object settings', async () => {
    const tenantSettings = { isAvailable: () => true, replaceForTenant: vi.fn() };
    const service = new TenantSettingsService(tenantSettings as never);
    await expect(
      service.putForTenant(userId, tenantId, { schemaVersion: 1, settings: [] }, undefined, corr),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects invalid schemaVersion', async () => {
    const tenantSettings = { isAvailable: () => true, replaceForTenant: vi.fn() };
    const service = new TenantSettingsService(tenantSettings as never);
    await expect(
      service.putForTenant(userId, tenantId, { schemaVersion: 0, settings: {} }, undefined, corr),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('replays identical idempotent PUT without re-writing', async () => {
    const store = new InMemoryIdempotencyStore();
    const tenantSettings = {
      isAvailable: () => true,
      replaceForTenant: vi.fn().mockResolvedValue(settingsDoc),
    };
    const service = new TenantSettingsService(tenantSettings as never, store);
    const body = { schemaVersion: 1, settings: { theme: 'light' } };
    const key = 'idem-key-tenant-settings-01';
    const first = await service.putForTenant(userId, tenantId, body, key, corr);
    const second = await service.putForTenant(userId, tenantId, body, key, corr);
    expect(first).toEqual(second);
    expect(tenantSettings.replaceForTenant).toHaveBeenCalledOnce();
  });

  it('conflicts when idempotency key reused with different body', async () => {
    const store = new InMemoryIdempotencyStore();
    const tenantSettings = {
      isAvailable: () => true,
      replaceForTenant: vi.fn().mockResolvedValue(settingsDoc),
    };
    const service = new TenantSettingsService(tenantSettings as never, store);
    const key = 'idem-key-tenant-settings-02';
    await service.putForTenant(
      userId,
      tenantId,
      { schemaVersion: 1, settings: { a: 1 } },
      key,
      corr,
    );
    await expect(
      service.putForTenant(userId, tenantId, { schemaVersion: 1, settings: { a: 2 } }, key, corr),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSE_MISMATCH' });
  });
});
