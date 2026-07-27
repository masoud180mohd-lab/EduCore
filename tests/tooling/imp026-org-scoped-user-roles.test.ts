import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-026 org-scoped user roles', () => {
  it('DSF-002 v1.14 documents org-scoped assign', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.(?:14|15|16|17|18)/);
    expect(dsf).toContain('IMP-026');
    expect(dsf).toMatch(/organization scope/i);
  });

  it('assign_user_role accepts organization_id', () => {
    const up = readFileSync(
      path.join(root, 'apps/api/db/migrations/20260727150000_org_scoped_user_roles.up.sql'),
      'utf8',
    );
    expect(up).toContain('p_organization_id uuid');
    expect(up).toContain('fk_user_roles_organization');
  });

  it('Nest parseAssignUserRoleRequest allows organizationId', () => {
    const service = readFileSync(
      path.join(root, 'apps/api/src/modules/identity-and-access/application/user-roles.service.ts'),
      'utf8',
    );
    expect(service).toContain('parseAssignUserRoleRequest');
    expect(service).toContain('organizationId');
  });

  it('User detail has scope select and honesty note', () => {
    const page = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/users/[userId]/page.tsx'),
      'utf8',
    );
    expect(page).toContain('Entire tenant');
    expect(page).toContain('/api/v1/organizations');
    expect(page).toContain('organizationId');
    expect(page).toMatch(/tenant-wide/i);
  });

  it('has task record', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-026-org-scoped-user-roles.md')),
    ).toBe(true);
  });
});
