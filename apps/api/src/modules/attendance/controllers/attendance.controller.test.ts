import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { AttendanceController } from './attendance.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const sessionId = '01900000-0000-7000-8000-0000000000a1';

describe('AttendanceController', () => {
  it('lists sessions', async () => {
    const sessionsService = {
      listForTenant: vi.fn().mockResolvedValue({ data: [], page: { nextCursor: null, limit: 25 } }),
    };
    const controller = new AttendanceController(sessionsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await controller.list(request as never);
    expect(sessionsService.listForTenant).toHaveBeenCalled();
  });

  it('rejects missing auth on list', async () => {
    const sessionsService = { listForTenant: vi.fn() };
    const controller = new AttendanceController(sessionsService as never);
    await expect(
      controller.list({ [TENANT_CONTEXT_REQUEST_KEY]: { tenantId } } as never),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('gets session by id', async () => {
    const sessionsService = {
      getForTenant: vi.fn().mockResolvedValue({ data: { id: sessionId } }),
    };
    const controller = new AttendanceController(sessionsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await controller.getById(request as never, sessionId);
    expect(sessionsService.getForTenant).toHaveBeenCalledWith(userId, tenantId, sessionId);
  });

  it('creates session with idempotency header', async () => {
    const sessionsService = {
      createForTenant: vi.fn().mockResolvedValue({ data: { id: sessionId } }),
    };
    const controller = new AttendanceController(sessionsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await controller.create(
      request as never,
      { classId: 'c1', sessionDate: '2026-07-21' },
      'key-1',
    );
    expect(sessionsService.createForTenant).toHaveBeenCalled();
  });

  it('lists records for session', async () => {
    const sessionsService = {
      listRecordsForTenant: vi.fn().mockResolvedValue({ data: [] }),
    };
    const controller = new AttendanceController(sessionsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await controller.listRecords(request as never, sessionId);
    expect(sessionsService.listRecordsForTenant).toHaveBeenCalledWith(userId, tenantId, sessionId);
  });
});
