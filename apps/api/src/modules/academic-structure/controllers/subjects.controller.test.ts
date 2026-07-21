import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { SubjectsController } from './subjects.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('SubjectsController', () => {
  it('lists subjects', async () => {
    const subjectsService = {
      listForTenant: vi.fn().mockResolvedValue({ data: [], page: { nextCursor: null, limit: 25 } }),
    };
    const controller = new SubjectsController(subjectsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await controller.list(request as never);
    expect(subjectsService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: undefined,
      cursor: undefined,
      status: undefined,
      search: undefined,
    });
  });

  it('gets by id', async () => {
    const subjectsService = {
      getForTenant: vi.fn().mockResolvedValue({ data: { id: 's1', name: 'Math' } }),
    };
    const controller = new SubjectsController(subjectsService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const id = '01900000-0000-7000-8000-0000000000a1';
    await controller.getById(request as never, id);
    expect(subjectsService.getForTenant).toHaveBeenCalledWith(userId, tenantId, id);
  });
});
