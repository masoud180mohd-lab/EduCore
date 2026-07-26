import { describe, expect, it, vi } from 'vitest';

import { InMemoryIdempotencyStore } from '../../../common/idempotency/index.js';
import { InMemoryAuditPublisher } from '../../platform-operations/index.js';
import { RolesService } from './roles.service.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const roleId = '01900000-0000-7000-8000-0000000000b1';
const role = {
  id: roleId,
  tenantId,
  code: 'teachers',
  name: 'Teachers',
  isSystem: false,
  permissions: ['user.read'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('RolesService', () => {
  it('lists roles with cursor pagination', async () => {
    const repository = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [role], nextCursor: roleId }),
    };
    const service = new RolesService(repository as never);
    await expect(service.listForTenant(actorId, tenantId, { limit: '10' })).resolves.toEqual({
      data: [role],
      page: { nextCursor: roleId, limit: 10 },
    });
  });

  it('requires an idempotency key when creating', async () => {
    const repository = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new RolesService(repository as never);
    await expect(
      service.createForTenant(
        actorId,
        tenantId,
        { code: 'teachers', name: 'Teachers' },
        undefined,
        'c1',
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('enforces the database role code format', async () => {
    const repository = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new RolesService(repository as never);
    await expect(
      service.createForTenant(
        actorId,
        tenantId,
        { code: 'teacher-admin', name: 'Teachers' },
        'idem-role-create-0001',
        'c1',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('creates once, audits, and replays idempotently', async () => {
    const repository = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockResolvedValue(role),
    };
    const store = new InMemoryIdempotencyStore();
    const audit = new InMemoryAuditPublisher();
    const service = new RolesService(repository as never, store, audit);
    const body = { code: 'teachers', name: 'Teachers', permissionCodes: ['user.read'] };
    const key = 'idem-role-create-0002';
    const first = await service.createForTenant(actorId, tenantId, body, key, 'c1');
    const second = await service.createForTenant(actorId, tenantId, body, key, 'c1');
    expect(second).toEqual(first);
    expect(repository.createForTenant).toHaveBeenCalledOnce();
    expect(audit.events[0]).toMatchObject({ action: 'role.create', resourceId: roleId });
  });

  it('renames only the name field', async () => {
    const renamed = { ...role, name: 'Teaching Staff' };
    const repository = {
      isAvailable: () => true,
      renameForTenant: vi.fn().mockResolvedValue(renamed),
    };
    const service = new RolesService(repository as never);
    await expect(
      service.renameForTenant(
        actorId,
        tenantId,
        roleId,
        { name: 'Teaching Staff' },
        undefined,
        'c1',
      ),
    ).resolves.toEqual({ data: renamed });
    await expect(
      service.renameForTenant(actorId, tenantId, roleId, { name: 'X', code: 'x' }, undefined, 'c1'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('maps system-role permission edits to FORBIDDEN', async () => {
    const error = Object.assign(new Error('system role permissions cannot be edited'), {
      code: '42501',
    });
    const repository = {
      isAvailable: () => true,
      replacePermissionsForTenant: vi.fn().mockRejectedValue(error),
    };
    const service = new RolesService(repository as never);
    await expect(
      service.replacePermissionsForTenant(
        actorId,
        tenantId,
        roleId,
        { permissionCodes: [] },
        undefined,
        'c1',
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'System role permissions cannot be edited.',
    });
  });
});
