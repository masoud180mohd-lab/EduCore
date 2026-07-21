import { describe, expect, it, vi } from 'vitest';

import { GuardiansService } from './guardians.service.js';

const userId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const guardianId = '01900000-0000-7000-8000-0000000000c1';
const studentId = '01900000-0000-7000-8000-0000000000c2';

describe('GuardiansService', () => {
  it('rejects create without idempotency key', async () => {
    const repo = { isAvailable: () => true, createForTenant: vi.fn() };
    const service = new GuardiansService(repo as never, null, null);
    await expect(
      service.createForTenant(userId, tenantId, { displayName: 'A' }, undefined, 'c1'),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('validates relationshipType on link create', async () => {
    const repo = {
      isAvailable: () => true,
      createLinkForTenant: vi.fn(),
    };
    const service = new GuardiansService(repo as never, null, null);
    await expect(
      service.createLinkForGuardian(
        userId,
        tenantId,
        guardianId,
        { studentId, relationshipType: 'cousin' },
        '0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d',
        'c1',
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('lists empty when repository unavailable', async () => {
    const repo = { isAvailable: () => false };
    const service = new GuardiansService(repo as never, null, null);
    const result = await service.listForTenant(userId, tenantId, {});
    expect(result.data).toEqual([]);
  });
});
