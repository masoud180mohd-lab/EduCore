import { describe, expect, it } from 'vitest';

import type { AdminNavId } from '@/lib/auth/admin-access';

import { ADMIN_HUB_BY_ID, visibleAdminHubQuickStarts } from './admin-hub.js';

describe('admin-hub', () => {
  it('maps every hub card by nav id', () => {
    expect(ADMIN_HUB_BY_ID.students?.title).toBe('Students');
    expect(ADMIN_HUB_BY_ID.fees?.hrefSuffix).toBe('/fees');
  });

  it('filters quick starts by visible nav ids', () => {
    const onlyFees = new Set<AdminNavId>(['home', 'fees']);
    const starts = visibleAdminHubQuickStarts(onlyFees);
    expect(starts.map((s) => s.id)).toEqual(['invoices']);
  });

  it('returns empty quick starts when no matching areas', () => {
    expect(visibleAdminHubQuickStarts(new Set<AdminNavId>(['home']))).toEqual([]);
  });
});
