import { describe, expect, it, vi } from 'vitest';

import { TenantSettingsRepository } from './tenant-settings.repository.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('TenantSettingsRepository', () => {
  it('returns null without a pool', async () => {
    const repo = new TenantSettingsRepository(null);
    await expect(repo.getForTenant(userId, tenantId)).resolves.toBeNull();
  });

  it('returns null for non-uuid ids', async () => {
    const connect = vi.fn();
    const repo = new TenantSettingsRepository({ connect } as never);
    await expect(repo.getForTenant('bad', tenantId)).resolves.toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  it('fails closed on DB errors and warns', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const connect = vi.fn().mockRejectedValue(new Error('pool down'));
    const repo = new TenantSettingsRepository({ connect } as never, logger);
    await expect(repo.getForTenant(userId, tenantId)).resolves.toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('failed closed');
  });

  it('maps settings document when row exists', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({
        rows: [
          {
            schema_version: 1,
            settings: { locale: 'en' },
            updated_at: new Date('2026-01-02T00:00:00.000Z'),
          },
        ],
      });
    });
    const connect = vi.fn().mockResolvedValue({
      query,
      release: vi.fn(),
    });
    const repo = new TenantSettingsRepository({ connect } as never);
    await expect(repo.getForTenant(userId, tenantId)).resolves.toEqual({
      schemaVersion: 1,
      settings: { locale: 'en' },
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('returns null when no settings row', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
    const connect = vi.fn().mockResolvedValue({
      query,
      release: vi.fn(),
    });
    const repo = new TenantSettingsRepository({ connect } as never);
    await expect(repo.getForTenant(userId, tenantId)).resolves.toBeNull();
  });

  it('replaceForTenant calls SECURITY DEFINER helper and maps row', async () => {
    const query = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql.startsWith('SELECT set_config') || sql === 'COMMIT') {
        return Promise.resolve({ rows: [] });
      }
      expect(sql).toContain('app.replace_tenant_settings');
      return Promise.resolve({
        rows: [
          {
            schema_version: 1,
            settings: { locale: 'sw' },
            updated_at: new Date('2026-01-03T00:00:00.000Z'),
          },
        ],
      });
    });
    const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() });
    const repo = new TenantSettingsRepository({ connect } as never);
    await expect(repo.replaceForTenant(userId, tenantId, 1, { locale: 'sw' })).resolves.toEqual({
      schemaVersion: 1,
      settings: { locale: 'sw' },
      updatedAt: '2026-01-03T00:00:00.000Z',
    });
  });

  it('replaceForTenant returns null without a pool', async () => {
    const repo = new TenantSettingsRepository(null);
    await expect(repo.replaceForTenant(userId, tenantId, 1, {})).resolves.toBeNull();
  });
});
