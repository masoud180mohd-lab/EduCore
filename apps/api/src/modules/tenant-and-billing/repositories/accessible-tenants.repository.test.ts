import { describe, expect, it, vi } from 'vitest';

import { AccessibleTenantsRepository } from './accessible-tenants.repository.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('AccessibleTenantsRepository', () => {
  it('returns empty list without a pool', async () => {
    const repo = new AccessibleTenantsRepository(null);
    await expect(repo.listAccessibleTenants(userId)).resolves.toEqual([]);
  });

  it('returns null for get without a pool', async () => {
    const repo = new AccessibleTenantsRepository(null);
    await expect(repo.getAccessibleTenantById(userId, tenantId)).resolves.toBeNull();
  });

  it('fails closed on list DB errors and warns', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const connect = vi.fn().mockRejectedValue(new Error('pool down'));
    const repo = new AccessibleTenantsRepository({ connect } as never, logger);
    await expect(repo.listAccessibleTenants(userId)).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('failed closed');
  });

  it('fails closed on get DB errors and warns', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const connect = vi.fn().mockRejectedValue(new Error('pool down'));
    const repo = new AccessibleTenantsRepository({ connect } as never, logger);
    await expect(repo.getAccessibleTenantById(userId, tenantId)).resolves.toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
});
