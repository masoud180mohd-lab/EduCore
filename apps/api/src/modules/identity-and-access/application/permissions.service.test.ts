import { describe, expect, it, vi } from 'vitest';

import { PermissionsService } from './permissions.service.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('PermissionsService', () => {
  it('returns the global permission catalog', async () => {
    const rows = [{ id: userId, code: 'role.read', description: 'Read roles' }];
    const repository = { isAvailable: () => true, list: vi.fn().mockResolvedValue(rows) };
    const service = new PermissionsService(repository as never);
    await expect(service.listForTenant(userId, tenantId)).resolves.toEqual({ data: rows });
  });

  it('rejects missing tenant context', async () => {
    const service = new PermissionsService({ isAvailable: () => true, list: vi.fn() } as never);
    await expect(service.listForTenant(userId, 'bad')).rejects.toMatchObject({
      code: 'TENANT_CONTEXT_REQUIRED',
    });
  });
});
