import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-021 user re-enable', () => {
  it('DSF-002 v1.10 documents user enable', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.(?:10|11|12|13|14|15|16|17|18|19|20)/);
    expect(dsf).toContain('IMP-021');
    expect(dsf).toMatch(/enable/i);
  });

  it('ACF-001 and OpenAPI document POST enable', () => {
    const acf = readFileSync(
      path.join(root, 'docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md'),
      'utf8',
    );
    expect(acf).toContain('/enable');
    const openapi = readFileSync(
      path.join(
        root,
        'docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml',
      ),
      'utf8',
    );
    expect(openapi).toContain('/users/{userId}/enable');
    expect(openapi).toContain('enableUser');
  });

  it('ships Nest enable helper and route', () => {
    const sql = readFileSync(
      path.join(root, 'apps/api/db/migrations/20260725050000_user_enable_helper.up.sql'),
      'utf8',
    );
    expect(sql).toContain('app.enable_user');
    const ctrl = readFileSync(
      path.join(root, 'apps/api/src/modules/identity-and-access/controllers/users.controller.ts'),
      'utf8',
    );
    expect(ctrl).toContain("@Post(':id/enable')");
  });

  it('Admin user detail has Enable user action', () => {
    const page = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/users/[userId]/page.tsx'),
      'utf8',
    );
    expect(page).toContain('/enable');
    expect(page).toContain("t('users.enableUser')");
  });

  it('has task record and manual QA', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-021-user-enable.md')),
    ).toBe(true);
    expect(existsSync(path.join(root, 'tasks/manual-test-admin-user-enable-qa.md'))).toBe(true);
  });
});
