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

  it('patches name and audits fields', async () => {
    const updated = { ...streamA, name: 'Alpha' };
    const streams = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(updated),
    };
    const audit = new InMemoryAuditPublisher();
    const service = new StreamsService(streams as never, null, audit);
    await expect(
      service.patchForTenant(actorId, tenantId, streamA.id, { name: 'Alpha' }, undefined, 'c'),
    ).resolves.toEqual({ data: updated });
    expect(streams.updateForTenant).toHaveBeenCalledWith(
      actorId,
      tenantId,
      streamA.id,
      expect.objectContaining({ setName: true, name: 'Alpha' }),
    );
    expect(audit.events[0]).toMatchObject({
      action: 'stream.patch',
      metadata: { fields: ['name'] },
    });
  });

  it('rejects empty patch body', async () => {
    const streams = { isAvailable: () => true, updateForTenant: vi.fn() };
    const service = new StreamsService(streams as never);
    await expect(
      service.patchForTenant(actorId, tenantId, streamA.id, {}, undefined, 'c'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(streams.updateForTenant).not.toHaveBeenCalled();
  });

  it('reparents to another class and passes flags to repo', async () => {
    const newClassId = '01900000-0000-7000-8000-0000000000e9';
    const updated = { ...streamA, classId: newClassId };
    const streams = {
      isAvailable: () => true,
      updateForTenant: vi.fn().mockResolvedValue(updated),
    };
    const audit = new InMemoryAuditPublisher();
    const service = new StreamsService(streams as never, null, audit);
    await expect(
      service.patchForTenant(
        actorId,
        tenantId,
        streamA.id,
        { classId: newClassId },
        undefined,
        'c',
      ),
    ).resolves.toEqual({ data: updated });
    expect(streams.updateForTenant).toHaveBeenCalledWith(
      actorId,
      tenantId,
      streamA.id,
      expect.objectContaining({ setClassId: true, classId: newClassId }),
    );
    expect(audit.events[0]).toMatchObject({
      action: 'stream.patch',
      metadata: { fields: ['classId'] },
    });
  });

  it('rejects non-uuid classId on patch', async () => {
    const streams = { isAvailable: () => true, updateForTenant: vi.fn() };
    const service = new StreamsService(streams as never);
    await expect(
      service.patchForTenant(actorId, tenantId, streamA.id, { classId: 'bad' }, undefined, 'c'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(streams.updateForTenant).not.toHaveBeenCalled();
  });

  it('deletes when empty and audits', async () => {
    const streams = { isAvailable: () => true, deleteForTenant: vi.fn().mockResolvedValue(true) };
    const audit = new InMemoryAuditPublisher();
    const service = new StreamsService(streams as never, null, audit);
    await expect(
      service.deleteForTenant(actorId, tenantId, streamA.id, 'c'),
    ).resolves.toBeUndefined();
    expect(streams.deleteForTenant).toHaveBeenCalledWith(actorId, tenantId, streamA.id);
    expect(audit.events[0]).toMatchObject({ action: 'stream.delete', outcome: 'success' });
  });

  it('maps missing to 404 on delete', async () => {
    const streams = { isAvailable: () => true, deleteForTenant: vi.fn().mockResolvedValue(false) };
    const service = new StreamsService(streams as never);
    await expect(service.deleteForTenant(actorId, tenantId, streamA.id, 'c')).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
  });

  it('maps has-dependents error to CONFLICT on delete', async () => {
    const streams = {
      isAvailable: () => true,
      deleteForTenant: vi.fn().mockRejectedValue({ code: 'P0001', message: 'has dependents' }),
    };
    const service = new StreamsService(streams as never);
    await expect(service.deleteForTenant(actorId, tenantId, streamA.id, 'c')).rejects.toMatchObject(
      { code: 'CONFLICT' },
    );
  });

  it('maps invalid id to 404 without repo call on delete', async () => {
    const streams = { isAvailable: () => true, deleteForTenant: vi.fn() };
    const service = new StreamsService(streams as never);
    await expect(
      service.deleteForTenant(actorId, tenantId, 'not-a-uuid', 'c'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(streams.deleteForTenant).not.toHaveBeenCalled();
  });
});
