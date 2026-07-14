import { describe, expect, it } from 'vitest';

import {
  AllowListTenantMembershipChecker,
  DenyAllTenantMembershipChecker,
} from '../tenant/index.js';
import { MembershipAwarePermissionSource } from './membership-aware-permission.source.js';
import { EmptyPermissionSource, MapPermissionSource } from './policy-evaluator.js';

describe('MembershipAwarePermissionSource', () => {
  it('returns empty permissions when membership is inactive', async () => {
    const inner = new MapPermissionSource(new Map([['u1::t1', new Set(['tenant.read'])]]));
    const source = new MembershipAwarePermissionSource(new DenyAllTenantMembershipChecker(), inner);
    await expect(source.getPermissions('u1', 't1')).resolves.toEqual(new Set());
  });

  it('delegates to inner source only for active members', async () => {
    const inner = new MapPermissionSource(new Map([['u1::t1', new Set(['tenant.read'])]]));
    const source = new MembershipAwarePermissionSource(
      new AllowListTenantMembershipChecker([{ userId: 'u1', tenantId: 't1' }]),
      inner,
    );
    await expect(source.getPermissions('u1', 't1')).resolves.toEqual(new Set(['tenant.read']));
    await expect(source.getPermissions('u1', 't2')).resolves.toEqual(new Set());
  });

  it('still yields empty when member but inner catalogue is EmptyPermissionSource', async () => {
    const source = new MembershipAwarePermissionSource(
      new AllowListTenantMembershipChecker([{ userId: 'u1', tenantId: 't1' }]),
      new EmptyPermissionSource(),
    );
    await expect(source.getPermissions('u1', 't1')).resolves.toEqual(new Set());
  });
});
