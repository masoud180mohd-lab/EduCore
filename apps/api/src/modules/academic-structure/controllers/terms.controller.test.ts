import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { TermsController } from './terms.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const yearId = '01900000-0000-7000-8000-0000000000c1';

describe('TermsController', () => {
  it('lists terms for authenticated principal with tenant context', async () => {
    const termsService = {
      listForTenant: vi.fn().mockResolvedValue({
        data: [{ id: 't1', name: 'Term 1', status: 'active' }],
        page: { nextCursor: null, limit: 25 },
      }),
    };
    const controller = new TermsController(termsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.list(request as never);
    expect(termsService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: undefined,
      cursor: undefined,
      academicYearId: undefined,
      status: undefined,
      search: undefined,
    });
    expect(result).toEqual({
      data: [{ id: 't1', name: 'Term 1', status: 'active' }],
      page: { nextCursor: null, limit: 25 },
    });
  });

  it('forwards pagination and filter query params including academicYearId', async () => {
    const termsService = {
      listForTenant: vi.fn().mockResolvedValue({ data: [], page: { nextCursor: null, limit: 10 } }),
    };
    const controller = new TermsController(termsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const cursorId = '01900000-0000-7000-8000-0000000000d1';
    await controller.list(request as never, '10', cursorId, yearId, 'active', 'Term');
    expect(termsService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: '10',
      cursor: cursorId,
      academicYearId: yearId,
      status: 'active',
      search: 'Term',
    });
  });

  it('rejects list when auth context is missing', async () => {
    const termsService = { listForTenant: vi.fn() };
    const controller = new TermsController(termsService as never);
    await expect(
      controller.list({ [TENANT_CONTEXT_REQUEST_KEY]: { tenantId } } as never),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(termsService.listForTenant).not.toHaveBeenCalled();
  });

  it('rejects list when tenant context is missing', async () => {
    const termsService = { listForTenant: vi.fn() };
    const controller = new TermsController(termsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
    };
    await expect(controller.list(request as never)).rejects.toMatchObject({
      code: 'TENANT_CONTEXT_REQUIRED',
    });
    expect(termsService.listForTenant).not.toHaveBeenCalled();
  });

  it('gets term by id', async () => {
    const termsService = {
      getForTenant: vi.fn().mockResolvedValue({ data: { id: 't1', name: 'Term 1' } }),
    };
    const controller = new TermsController(termsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const termId = '01900000-0000-7000-8000-0000000000d1';
    await expect(controller.getById(request as never, termId)).resolves.toEqual({
      data: { id: 't1', name: 'Term 1' },
    });
    expect(termsService.getForTenant).toHaveBeenCalledWith(userId, tenantId, termId);
  });

  it('rejects getById when auth context is missing', async () => {
    const termsService = { getForTenant: vi.fn() };
    const controller = new TermsController(termsService as never);
    await expect(
      controller.getById({ [TENANT_CONTEXT_REQUEST_KEY]: { tenantId } } as never, 'x'),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(termsService.getForTenant).not.toHaveBeenCalled();
  });

  it('creates term with idempotency header', async () => {
    const termsService = {
      createForTenant: vi.fn().mockResolvedValue({ data: { id: 't1', name: 'Term 1' } }),
    };
    const controller = new TermsController(termsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await controller.create(
      request as never,
      { academicYearId: yearId, name: 'Term 1' },
      'idem-key-term-create-01',
    );
    expect(termsService.createForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      { academicYearId: yearId, name: 'Term 1' },
      'idem-key-term-create-01',
      'unknown',
    );
  });
});
