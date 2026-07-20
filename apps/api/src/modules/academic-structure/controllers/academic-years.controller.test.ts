import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { AcademicYearsController } from './academic-years.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('AcademicYearsController', () => {
  it('lists academic years for authenticated principal with tenant context', async () => {
    const academicYearsService = {
      listForTenant: vi.fn().mockResolvedValue({
        data: [{ id: 'y1', name: '2026/2027', status: 'active' }],
        page: { nextCursor: null, limit: 25 },
      }),
    };
    const controller = new AcademicYearsController(academicYearsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.list(request as never);
    expect(academicYearsService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: undefined,
      cursor: undefined,
      status: undefined,
      search: undefined,
    });
    expect(result).toEqual({
      data: [{ id: 'y1', name: '2026/2027', status: 'active' }],
      page: { nextCursor: null, limit: 25 },
    });
  });

  it('forwards pagination and filter query params', async () => {
    const academicYearsService = {
      listForTenant: vi.fn().mockResolvedValue({ data: [], page: { nextCursor: null, limit: 10 } }),
    };
    const controller = new AcademicYearsController(academicYearsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const cursorId = '01900000-0000-7000-8000-0000000000c1';
    await controller.list(request as never, '10', cursorId, 'active', '2026');
    expect(academicYearsService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: '10',
      cursor: cursorId,
      status: 'active',
      search: '2026',
    });
  });

  it('rejects list when auth context is missing', async () => {
    const academicYearsService = { listForTenant: vi.fn() };
    const controller = new AcademicYearsController(academicYearsService as never);
    await expect(
      controller.list({ [TENANT_CONTEXT_REQUEST_KEY]: { tenantId } } as never),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(academicYearsService.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects list when tenant context is missing', async () => {
    const academicYearsService = { listForTenant: vi.fn() };
    const controller = new AcademicYearsController(academicYearsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
    };
    await expect(controller.list(request as never)).rejects.toMatchObject({
      code: 'TENANT_CONTEXT_REQUIRED',
    });
    expect(academicYearsService.listForTenant).not.toHaveBeenCalled();
  });

  it('gets academic year by id', async () => {
    const academicYearsService = {
      getForTenant: vi.fn().mockResolvedValue({ data: { id: 'y1', name: '2026/2027' } }),
    };
    const controller = new AcademicYearsController(academicYearsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const yearId = '01900000-0000-7000-8000-0000000000c1';
    await expect(controller.getById(request as never, yearId)).resolves.toEqual({
      data: { id: 'y1', name: '2026/2027' },
    });
    expect(academicYearsService.getForTenant).toHaveBeenCalledWith(userId, tenantId, yearId);
  });

  it('creates academic year with idempotency header', async () => {
    const academicYearsService = {
      createForTenant: vi.fn().mockResolvedValue({ data: { id: 'y1', name: '2026/2027' } }),
    };
    const controller = new AcademicYearsController(academicYearsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await controller.create(request as never, { name: '2026/2027' }, 'idem-key-ay-create-01');
    expect(academicYearsService.createForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      { name: '2026/2027' },
      'idem-key-ay-create-01',
      'unknown',
    );
  });
});
