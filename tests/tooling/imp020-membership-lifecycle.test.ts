import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-020 membership lifecycle', () => {
  it('DSF-002 v1.9 documents membership lifecycle on user detail', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.(?:9|10|11|12)/);
    expect(dsf).toContain('IMP-020');
    expect(dsf).toMatch(/suspend|reactivate|remove/i);
    expect(dsf).toMatch(/membership/i);
  });

  it('migration defines suspend/reactivate/remove DEFINER helpers', () => {
    const up = readFileSync(
      path.join(root, 'apps/api/db/migrations/20260725040000_membership_lifecycle_helpers.up.sql'),
      'utf8',
    );
    expect(up).toContain('app.suspend_membership');
    expect(up).toContain('app.reactivate_membership');
    expect(up).toContain('app.remove_membership');
    expect(up).toMatch(/SECURITY DEFINER/i);
  });

  it('Nest controller exposes lifecycle POSTs with user.manage', () => {
    const ctrl = readFileSync(
      path.join(
        root,
        'apps/api/src/modules/identity-and-access/controllers/memberships.controller.ts',
      ),
      'utf8',
    );
    expect(ctrl).toContain("@Post(':id/suspend')");
    expect(ctrl).toContain("@Post(':id/reactivate')");
    expect(ctrl).toContain("@Post(':id/remove')");
    expect(ctrl).toContain("RequirePermission('user.manage')");
  });

  it('Admin user detail has membership lifecycle UI without deferred copy', () => {
    const page = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/users/[userId]/page.tsx'),
      'utf8',
    );
    expect(page).toContain('/api/v1/memberships');
    expect(page).toContain('Suspend membership');
    expect(page).toContain('Reactivate membership');
    expect(page).toContain('Remove membership');
    expect(page).not.toMatch(/not in this UI yet/i);
  });

  it('has task record and manual QA', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-020-membership-lifecycle.md')),
    ).toBe(true);
    expect(existsSync(path.join(root, 'tasks/manual-test-admin-membership-lifecycle-qa.md'))).toBe(
      true,
    );
  });
});
