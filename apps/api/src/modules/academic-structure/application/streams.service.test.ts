import { describe, expect, it, vi } from 'vitest';

import { InMemoryIdempotencyStore } from '../../../common/idempotency/index.js';
import { InMemoryAuditPublisher } from '../../platform-operations/index.js';
import { StreamsService } from './streams.service.js';

const actorId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const classId = '01900000-0000-7000-8000-0000000000e1';
const streamA = {
  id: '01900000-0000-7000-8000-0000000000f1',
  tenantId,
  classId,
  name: 'A',
  code: 'A',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('StreamsService', () => {
  it('lists streams', async () => {
    const streams = {
      isAvailable: () => true,
      listForTenant: vi.fn().mockResolvedValue({ rows: [streamA], nextCursor: null }),
    };
    const service = new StreamsService(streams as never);
    await expect(service.listForTenant(actorId, tenantId, {})).resolves.toMatchObject({
      data: [streamA],
    });
  });

  it('rejects non-uuid classId filter', async () => {
    const streams = { isAvailable: () => true, listForTenant: vi.fn() };
    const service = new StreamsService(streams as never);
    await expect(
      service.listForTenant(actorId, tenantId, { classId: 'bad' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('get 404 for missing', async () => {
    const streams = {
      isAvailable: () => true,
      getByIdForTenant: vi.fn().mockResolvedValue(null),
    };
    const service = new StreamsService(streams as never);
    await expect(service.getForTenant(actorId, tenantId, streamA.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('creates with idempotency', async () => {
    const streams = {
      isAvailable: () => true,
      createForTenant: vi.fn().mockResolvedValue(streamA),
    };
    const service = new StreamsService(
      streams as never,
      new InMemoryIdempotencyStore(),
      new InMemoryAuditPublisher(),
    );
    const key = 'idem-key-stream-create-0001';
    const body = { classId, name: 'A', status: 'active' };
    const first = await service.createForTenant(actorId, tenantId, body, key, 'c1');
    streams.createForTenant.mockClear();
    const second = await service.createForTenant(actorId, tenantId, body, key, 'c1');
    expect(second).toEqual(first);
    expect(streams.createForTenant).not.toHaveBeenCalled();
  });
});
