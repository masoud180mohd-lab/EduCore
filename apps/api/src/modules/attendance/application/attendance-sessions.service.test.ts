import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../common/errors/app-error.js';
import { AttendanceSessionsService } from './attendance-sessions.service.js';

const actorUserId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const sessionId = '01900000-0000-7000-8000-0000000000a1';
const classId = '01900000-0000-7000-8000-0000000000e1';

function makeService(repo: Record<string, unknown>): AttendanceSessionsService {
  return new AttendanceSessionsService(repo as never, null, null);
}

describe('AttendanceSessionsService', () => {
  it('returns empty page when store unavailable', async () => {
    const service = makeService({ isAvailable: () => false });
    const result = await service.listForTenant(actorUserId, tenantId, {});
    expect(result.data).toEqual([]);
    expect(result.page.limit).toBe(25);
  });

  it('returns 404 for unknown session', async () => {
    const service = makeService({
      isAvailable: () => true,
      getSession: vi.fn().mockResolvedValue(null),
    });
    await expect(service.getForTenant(actorUserId, tenantId, sessionId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('validates sessionDate filter', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.listForTenant(actorUserId, tenantId, { sessionDate: 'not-a-date' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects create without idempotency key', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.createForTenant(
        actorUserId,
        tenantId,
        { classId, sessionDate: '2026-07-21' },
        undefined,
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('rejects upsert on closed session', async () => {
    const service = makeService({
      isAvailable: () => true,
      getSession: vi.fn().mockResolvedValue({ id: sessionId, status: 'closed' }),
    });
    await expect(
      service.upsertRecordsForTenant(
        actorUserId,
        tenantId,
        sessionId,
        { records: [{ studentId: actorUserId, status: 'present' }] },
        '0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d',
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects empty records array', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(
      service.upsertRecordsForTenant(
        actorUserId,
        tenantId,
        sessionId,
        { records: [] },
        '0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d',
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('maps duplicate session day to conflict', async () => {
    const service = makeService({
      isAvailable: () => true,
      createSession: vi.fn().mockRejectedValue({ code: '23505' }),
    });
    await expect(
      service.createForTenant(
        actorUserId,
        tenantId,
        { classId, sessionDate: '2026-07-21' },
        '0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d',
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('maps class not found on create', async () => {
    const service = makeService({
      isAvailable: () => true,
      createSession: vi.fn().mockRejectedValue({ code: '22023', message: 'class not found' }),
    });
    await expect(
      service.createForTenant(
        actorUserId,
        tenantId,
        { classId, sessionDate: '2026-07-21' },
        '0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d',
        'corr',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('throws unauthorized for bad actor id', async () => {
    const service = makeService({ isAvailable: () => true });
    await expect(service.listForTenant('bad', tenantId, {})).rejects.toBeInstanceOf(AppError);
  });
});
