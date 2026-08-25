import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-022 roles admin', () => {
  it('DSF-002 v1.11 documents Roles Admin', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.(?:11|12|13|14|15|16|17|18|19|20)/);
    expect(dsf).toContain('IMP-022');
    expect(dsf).toMatch(/Roles list \+ create|Roles Admin/i);
    expect(dsf).not.toMatch(/\/roles HTTP missing/);
  });

  it('migration defines role-admin DEFINER helpers', () => {
    const up = readFileSync(
      path.join(root, 'apps/api/db/migrations/20260725060000_roles_admin_helpers.up.sql'),
      'utf8',
    );
    expect(up).toContain('app.create_custom_role');
    expect(up).toContain('app.rename_role');
    expect(up).toContain('app.replace_role_permissions');
    expect(up).toContain('app.assign_user_role');
    expect(up).toContain('app.unassign_user_role');
  });

  it('Nest registers roles, permissions, and user-roles controllers', () => {
    const roles = readFileSync(
      path.join(root, 'apps/api/src/modules/identity-and-access/controllers/roles.controller.ts'),
      'utf8',
    );
    expect(roles).toContain("@Controller('api/v1/roles')");
    expect(roles).toContain("RequirePermission('role.read')");
    expect(roles).toContain("RequirePermission('role.manage')");
    const perms = readFileSync(
      path.join(
        root,
        'apps/api/src/modules/identity-and-access/controllers/permissions.controller.ts',
      ),
      'utf8',
    );
    expect(perms).toContain("@Controller('api/v1/permissions')");
    const userRoles = readFileSync(
      path.join(
        root,
        'apps/api/src/modules/identity-and-access/controllers/user-roles.controller.ts',
      ),
      'utf8',
    );
    expect(userRoles).toContain("@Controller('api/v1/user-roles')");
    expect(userRoles).toContain('@Delete');
  });

  it('Admin Roles UI and shell nav exist', () => {
    const list = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/roles/page.tsx'),
      'utf8',
    );
    expect(list).toContain('/api/v1/roles');
    expect(list).toContain("t('roles.create')");
    const detail = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/roles/[roleId]/page.tsx'),
      'utf8',
    );
    expect(detail).toContain('/permissions');
    expect(detail).toContain("t('roles.permissions')");
    expect(detail).toContain("t('common.save')");
    const shell = readFileSync(path.join(root, 'apps/web/src/components/AdminShell.tsx'), 'utf8');
    expect(shell).toContain('/roles');
    const userDetail = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/users/[userId]/page.tsx'),
      'utf8',
    );
    expect(userDetail).toContain('/api/v1/user-roles');
    expect(userDetail).toContain("t('users.assignRole')");
  });

  it('has task record and manual QA', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-022-roles-admin.md')),
    ).toBe(true);
    expect(existsSync(path.join(root, 'tasks/manual-test-admin-roles-qa.md'))).toBe(true);
  });
});
