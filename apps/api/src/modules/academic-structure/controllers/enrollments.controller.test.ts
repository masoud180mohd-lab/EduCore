import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { EnrollmentsController } from './enrollments.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('EnrollmentsController', () => {
  it('lists enrollments', async () => {
    const enrollmentsService = {
      listForTenant: vi.fn().mockResolvedValue({ data: [], page: { nextCursor: null, limit: 25 } }),
    };
    const controller = new EnrollmentsController(enrollmentsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await controller.list(request as never);
    expect(enrollmentsService.listForTenant).toHaveBeenCalled();
  });

  it('rejects missing auth on list', async () => {
    const enrollmentsService = { listForTenant: vi.fn() };
    const controller = new EnrollmentsController(enrollmentsService as never);
    await expect(
      controller.list({ [TENANT_CONTEXT_REQUEST_KEY]: { tenantId } } as never),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('gets by id', async () => {
    const enrollmentsService = {
      getForTenant: vi.fn().mockResolvedValue({ data: { id: 'e1' } }),
    };
    const controller = new EnrollmentsController(enrollmentsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const id = '01900000-0000-7000-8000-0000000000a1';
    await controller.getById(request as never, id);
    expect(enrollmentsService.getForTenant).toHaveBeenCalledWith(userId, tenantId, id);
  });
});
