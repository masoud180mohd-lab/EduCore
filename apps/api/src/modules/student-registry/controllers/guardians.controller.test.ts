import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import { AUTH_CONTEXT_REQUEST_KEY } from '../../../common/auth/auth.constants.js';
import { TENANT_CONTEXT_REQUEST_KEY } from '../../../common/tenant/tenant.constants.js';
import { GuardiansController } from './guardians.controller.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const guardianId = '01900000-0000-7000-8000-0000000000g1';

describe('GuardiansController', () => {
  it('lists guardians for authenticated principal', async () => {
    const guardiansService = {
      listForTenant: vi.fn().mockResolvedValue({
        data: [{ id: guardianId, displayName: 'Mama Asha', status: 'active' }],
        page: { nextCursor: null, limit: 25 },
      }),
    };
    const controller = new GuardiansController(guardiansService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
    };
    const result = await controller.list(request as never);
    expect(guardiansService.listForTenant).toHaveBeenCalledWith(userId, tenantId, {
      limit: undefined,
      cursor: undefined,
      status: undefined,
      search: undefined,
    });
    expect(result).toMatchObject({
      data: [{ id: guardianId, displayName: 'Mama Asha' }],
    });
  });

  it('creates guardian with idempotency header', async () => {
    const guardiansService = {
      createForTenant: vi.fn().mockResolvedValue({
        data: { id: guardianId, displayName: 'Mama Asha' },
      }),
    };
    const controller = new GuardiansController(guardiansService as never);
    const request = {
      [AUTH_CONTEXT_REQUEST_KEY]: { userId, sessionId: 's1', tenantId, tokenType: 'bearer' },
      [TENANT_CONTEXT_REQUEST_KEY]: { tenantId },
      [Symbol.for('correlation')]: undefined,
    };
    await controller.create(request as never, { displayName: 'Mama Asha' }, 'idem-1');
    expect(guardiansService.createForTenant).toHaveBeenCalledWith(
      userId,
      tenantId,
      { displayName: 'Mama Asha' },
      'idem-1',
      'unknown',
    );
  });

  it('rejects list without auth', async () => {
    const guardiansService = { listForTenant: vi.fn() };
    const controller = new GuardiansController(guardiansService as never);
    await expect(
      controller.list({ [TENANT_CONTEXT_REQUEST_KEY]: { tenantId } } as never),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
