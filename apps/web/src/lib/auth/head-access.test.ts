import { describe, expect, it } from 'vitest';

import { canAccessHeadPortal } from './head-access';
import { prefersHeadHome } from './home-preference';

describe('prefersHeadHome / canAccessHeadPortal', () => {
  it('allows marks.approve', () => {
    expect(prefersHeadHome({ permissions: ['marks.approve'] })).toBe(true);
    expect(canAccessHeadPortal({ permissions: ['marks.approve'] })).toBe(true);
  });

  it('allows owner/admin role fallback', () => {
    expect(prefersHeadHome({ roles: [{ code: 'owner' }] })).toBe(true);
    expect(prefersHeadHome({ roles: [{ code: 'admin' }] })).toBe(true);
  });

  it('denies staff without approve', () => {
    expect(
      prefersHeadHome({
        roles: [{ code: 'staff' }],
        permissions: ['attendance.manage', 'marks.manage'],
      }),
    ).toBe(false);
  });

  it('denies bursar without marks.approve', () => {
    expect(prefersHeadHome({ roles: [{ code: 'bursar' }], permissions: ['finance.manage'] })).toBe(
      false,
    );
  });
});
