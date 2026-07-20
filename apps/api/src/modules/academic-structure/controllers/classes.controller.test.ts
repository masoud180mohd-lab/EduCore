import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { ClassesController } from './classes.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';

describe('ClassesController', () => {
  it('lists classes for authenticated principal', async () => {
    const classesService = {
      listForTenant: vi.fn().mockResolvedValue({
        data: [{ id: 'c1', name: 'Form 1A' }],
        page: { nextCursor: null, limit: 25 },
      }),
    };
    const controller = new ClassesController(classesService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    await expect(controller.list(request as never)).resolves.toMatchObject({
      data: [{ id: 'c1' }],
    });
    expect(classesService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: undefined,
      cursor: undefined,
      academicYearId: undefined,
      termId: undefined,
      status: undefined,
      search: undefined,
    });
  });

  it('rejects missing auth', async () => {
    const classesService = { listForTenant: vi.fn() };
    const controller = new ClassesController(classesService as never);
    await expect(
      controller.list({ [TENANT_CONTEXT_REQUEST_KEY]: { tenantId } } as never),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
