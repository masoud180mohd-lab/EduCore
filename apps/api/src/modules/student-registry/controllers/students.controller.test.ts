import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { StudentsController } from './students.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('StudentsController', () => {
  it('lists students for authenticated principal with tenant context', async () => {
    const studentsService = {
      listForTenant: vi.fn().mockResolvedValue({
        data: [{ id: 's1', displayName: 'Asha', status: 'active' }],
        page: { nextCursor: null, limit: 25 },
      }),
    };
    const controller = new StudentsController(studentsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.list(request as never);
    expect(studentsService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: undefined,
      cursor: undefined,
      status: undefined,
      search: undefined,
    });
    expect(result).toEqual({
      data: [{ id: 's1', displayName: 'Asha', status: 'active' }],
      page: { nextCursor: null, limit: 25 },
    });
  });

  it('forwards pagination and filter query params', async () => {
    const studentsService = {
      listForTenant: vi.fn().mockResolvedValue({ data: [], page: { nextCursor: null, limit: 10 } }),
    };
    const controller = new StudentsController(studentsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const cursorId = '01900000-0000-7000-8000-0000000000b1';
    await controller.list(request as never, '10', cursorId, 'active', 'asha');
    expect(studentsService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: '10',
      cursor: cursorId,
      status: 'active',
      search: 'asha',
    });
  });

  it('rejects list when auth context is missing', async () => {
    const studentsService = { listForTenant: vi.fn() };
    const controller = new StudentsController(studentsService as never);
    await expect(
      controller.list({ [TENANT_CONTEXT_REQUEST_KEY]: { tenantId } } as never),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(studentsService.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects list when tenant context is missing', async () => {
    const studentsService = { listForTenant: vi.fn() };
    const controller = new StudentsController(studentsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
    };
    await expect(controller.list(request as never)).rejects.toMatchObject({
      code: 'TENANT_CONTEXT_REQUIRED',
    });
  });

  it('documents list + create + getById + patch surface (no delete)', () => {
    const proto = StudentsController.prototype as unknown as Record<string, unknown>;
    expect(typeof proto['list']).toBe('function');
    expect(typeof proto['create']).toBe('function');
    expect(typeof proto['getById']).toBe('function');
    expect(typeof proto['patch']).toBe('function');
    expect(proto['update']).toBeUndefined();
    expect(proto['remove']).toBeUndefined();
  });

  it('creates student for bound tenant', async () => {
    const studentsService = {
      createForTenant: vi.fn().mockResolvedValue({
        data: { id: 's1', displayName: 'Asha', status: 'active' },
      }),
    };
    const controller = new StudentsController(studentsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const body = { displayName: 'Asha' };
    const result = await controller.create(request as never, body, 'idem-key-abcdefghijkl');
    expect(studentsService.createForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      body,
      'idem-key-abcdefghijkl',
      'unknown',
    );
    expect(result).toEqual({ data: { id: 's1', displayName: 'Asha', status: 'active' } });
  });

  it('gets student by id for bound tenant', async () => {
    const targetId = '01900000-0000-7000-8000-0000000000b1';
    const studentsService = {
      getForTenant: vi.fn().mockResolvedValue({
        data: { id: targetId, displayName: 'Asha', status: 'active' },
      }),
    };
    const controller = new StudentsController(studentsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.getById(request as never, targetId);
    expect(studentsService.getForTenant).toHaveBeenCalledWith(userId, tenantId, targetId);
    expect(result).toEqual({
      data: { id: targetId, displayName: 'Asha', status: 'active' },
    });
  });

  it('patches student by id', async () => {
    const targetId = '01900000-0000-7000-8000-0000000000b1';
    const studentsService = {
      patchForTenant: vi.fn().mockResolvedValue({
        data: { id: targetId, displayName: 'Asha', status: 'inactive' },
      }),
    };
    const controller = new StudentsController(studentsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await controller.patch(request as never, targetId, { status: 'inactive' }, undefined);
    expect(studentsService.patchForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      targetId,
      { status: 'inactive' },
      undefined,
      'unknown',
    );
  });

  it('rejects getById when auth context is missing', async () => {
    const studentsService = { getForTenant: vi.fn() };
    const controller = new StudentsController(studentsService as never);
    await expect(
      controller.getById(
        { [TENANT_CONTEXT_REQUEST_KEY]: { tenantId } } as never,
        '01900000-0000-7000-8000-0000000000b1',
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(studentsService.getForTenant).not.toHaveBeenCalled();
  });
});
