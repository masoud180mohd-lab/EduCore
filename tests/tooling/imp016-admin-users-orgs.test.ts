import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-016 admin users/orgs + Nest writes', () => {
  it('DSF-002 v1.5 documents users invite/edit/disable and orgs create/edit/deactivate', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.(?:[5-9]|10|11|12)/);
    expect(dsf).toContain('IMP-016');
    expect(dsf).toMatch(/Users list \+ invite \+ edit|invite form/i);
    expect(dsf).toMatch(/Organizations list \+ create \+ edit|Org create\/edit/i);
  });

  it('ships Nest org PATCH/deactivate and user disable', () => {
    const orgCtrl = readFileSync(
      path.join(
        root,
        'apps/api/src/modules/tenant-and-billing/controllers/organizations.controller.ts',
      ),
      'utf8',
    );
    expect(orgCtrl).toContain("@Patch(':id')");
    expect(orgCtrl).toContain("@Post(':id/deactivate')");
    expect(orgCtrl).not.toMatch(/@(Delete)\(/);

    const userCtrl = readFileSync(
      path.join(root, 'apps/api/src/modules/identity-and-access/controllers/users.controller.ts'),
      'utf8',
    );
    expect(userCtrl).toContain("@Post(':id/disable')");
    expect(userCtrl).toContain("RequirePermission('user.manage')");

    const migration = path.join(
      root,
      'apps/api/db/migrations/20260725020000_org_patch_user_disable_helpers.up.sql',
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, 'utf8');
    expect(sql).toContain('app.update_organization');
    expect(sql).toContain('app.deactivate_organization');
    expect(sql).toContain('app.disable_user');
  });

  it('ships Admin orgs and users create/invite and detail pages', () => {
    const orgBase = path.join(root, 'apps/web/src/app/t/[tenantId]/admin/organizations');
    expect(existsSync(path.join(orgBase, 'page.tsx'))).toBe(true);
    expect(existsSync(path.join(orgBase, '[organizationId]', 'page.tsx'))).toBe(true);
    const orgList = readFileSync(path.join(orgBase, 'page.tsx'), 'utf8');
    expect(orgList).toContain("method: 'POST'");
    expect(orgList).toContain('/api/v1/organizations');
    const orgDetail = readFileSync(path.join(orgBase, '[organizationId]', 'page.tsx'), 'utf8');
    expect(orgDetail).toContain("method: 'PATCH'");
    expect(orgDetail).toContain('/deactivate');
    expect(orgDetail).not.toContain("method: 'DELETE'");

    const userBase = path.join(root, 'apps/web/src/app/t/[tenantId]/admin/users');
    expect(existsSync(path.join(userBase, 'page.tsx'))).toBe(true);
    expect(existsSync(path.join(userBase, '[userId]', 'page.tsx'))).toBe(true);
    const userList = readFileSync(path.join(userBase, 'page.tsx'), 'utf8');
    expect(userList).toContain('/api/v1/memberships');
    expect(userList).toContain("method: 'POST'");
    const userDetail = readFileSync(path.join(userBase, '[userId]', 'page.tsx'), 'utf8');
    expect(userDetail).toContain("method: 'PATCH'");
    expect(userDetail).toContain('/disable');
  });

  it('has task record and manual QA checklist', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-016-admin-users-orgs.md')),
    ).toBe(true);
    expect(existsSync(path.join(root, 'tasks/manual-test-admin-users-orgs-qa.md'))).toBe(true);
  });
});
