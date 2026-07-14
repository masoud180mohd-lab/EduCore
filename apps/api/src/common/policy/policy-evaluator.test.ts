import { describe, expect, it } from 'vitest';

import { AppError } from '../errors/app-error.js';
import { EmptyPermissionSource, MapPermissionSource, PolicyEvaluator } from './policy-evaluator.js';

describe('PolicyEvaluator foundation', () => {
  it('denies when permission source is empty', async () => {
    const evaluator = new PolicyEvaluator(new EmptyPermissionSource());
    await expect(evaluator.hasPermission('u1', 't1', 'tenant.read')).resolves.toBe(false);
    await expect(evaluator.requirePermission('u1', 't1', 'tenant.read')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('allows when permission is present for tenant-scoped user', async () => {
    const source = new MapPermissionSource(
      new Map([['u1::t1', new Set(['tenant.read', 'user.read'])]]),
    );
    const evaluator = new PolicyEvaluator(source);

    await expect(evaluator.hasPermission('u1', 't1', 'tenant.read')).resolves.toBe(true);
    await expect(evaluator.requirePermission('u1', 't1', 'tenant.read')).resolves.toBeUndefined();
    await expect(evaluator.hasPermission('u1', 't2', 'tenant.read')).resolves.toBe(false);
  });

  it('requireAny succeeds if one of the permissions matches', async () => {
    const source = new MapPermissionSource(new Map([['u1::t1', new Set(['user.read'])]]));
    const evaluator = new PolicyEvaluator(source);

    await expect(
      evaluator.requireAny('u1', 't1', ['tenant.manage', 'user.read']),
    ).resolves.toBeUndefined();

    try {
      await evaluator.requireAny('u1', 't1', ['tenant.manage', 'role.manage']);
      expect.unreachable('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('FORBIDDEN');
    }
  });
});
