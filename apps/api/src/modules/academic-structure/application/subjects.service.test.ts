import { describe, expect, it, vi } from 'vitest';

import { InMemoryIdempotencyStore } from '../../../common/idempotency/index.js';
import { InMemoryAuditPublisher } from '../../platform-operations/index.js';
import { SubjectsService } from './subjects.service.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const subjectA = {
  id: '01900000-0000-7000-8000-0000000000a1',
  tenantId,
  name: 'Math',
  code: 'MTH',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('SubjectsService', () => {
  it('lists subjects', async () => {
    const subjects = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [subjectA], nextCursor: null }),
    };
    const service = new SubjectsService(subjects as never);
    await expect(service.listForTenant(actorId, tenantId, {})).resolves.toMatchObject({
      data: [subjectA],
    });
  });

  it('get 404 for bad uuid', async () => {
    const subjects = { isAvailable: () => true, getByIdForTenant: vi.fn() };
    const service = new SubjectsService(subjects as never);
    await expect(service.getForTenant(actorId, tenantId, 'x')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(subjects.getByIdForTenant).not.toHaveBeenCalled();
  });

  it('creates with idempotency', async () => {
    const subjects = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockResolvedValue(subjectA),
    };
    const service = new SubjectsService(
      subjects as never,
      new InMemoryIdempotencyStore(),
      new InMemoryAuditPublisher(),
    );
    const key = 'idem-key-subject-create-001';
    const body = { name: 'Math', code: 'MTH' };
    const first = await service.createForTenant(actorId, tenantId, body, key, 'c1');
    subjects.createForTenant.mockClear();
    const second = await service.createForTenant(actorId, tenantId, body, key, 'c1');
    expect(second).toEqual(first);
    expect(subjects.createForTenant).not.toHaveBeenCalled();
  });

  it('requires idempotency key', async () => {
    const subjects = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new SubjectsService(subjects as never);
    await expect(
      service.createForTenant(actorId, tenantId, { name: 'Math' }, undefined, 'c'),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });
});
