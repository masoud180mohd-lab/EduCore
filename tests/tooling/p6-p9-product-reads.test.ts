import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(projectRoot, rel), 'utf8');
}

describe('IMP-001 P6–P9 product read increments (structural)', () => {
  it('registers organizations list + get + create + patch + deactivate (IMP-016)', () => {
    const ctrl = read(
      'apps/api/src/modules/tenant-and-billing/controllers/organizations.controller.ts',
    );
    expect(ctrl).toContain("@Controller('api/v1/organizations')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain('@Post()');
    expect(ctrl).toContain("@Get(':id')");
    expect(ctrl).toContain("@Patch(':id')");
    expect(ctrl).toContain("@Post(':id/deactivate')");
    expect(ctrl).toContain("RequirePermission('organization.read')");
    expect(ctrl).toContain("RequirePermission('organization.manage')");
    expect(ctrl).not.toMatch(/@(Delete)\(/);
  });

  it('registers tenant-settings get + put (P14) without patch/delete', () => {
    const ctrl = read(
      'apps/api/src/modules/tenant-and-billing/controllers/tenant-settings.controller.ts',
    );
    expect(ctrl).toContain("@Controller('api/v1/tenant-settings')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain('@Put()');
    expect(ctrl).toContain("RequirePermission('tenant.read')");
    expect(ctrl).toContain("RequirePermission('tenant.manage')");
    expect(ctrl).not.toMatch(/@(Post|Patch|Delete)\(/);
  });

  it('registers memberships list + get + invite + lifecycle (IMP-020)', () => {
    const ctrl = read(
      'apps/api/src/modules/identity-and-access/controllers/memberships.controller.ts',
    );
    expect(ctrl).toContain("@Controller('api/v1/memberships')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain('@Post()');
    expect(ctrl).toContain("@Get(':id')");
    expect(ctrl).toContain("@Post(':id/suspend')");
    expect(ctrl).toContain("@Post(':id/reactivate')");
    expect(ctrl).toContain("@Post(':id/remove')");
    expect(ctrl).toContain("RequirePermission('user.read')");
    expect(ctrl).toContain("RequirePermission('user.invite')");
    expect(ctrl).toContain("RequirePermission('user.manage')");
    expect(ctrl).not.toMatch(/@(Put|Patch|Delete)\(/);
  });

  it('registers users list + get + patch + disable (IMP-016) without create', () => {
    const ctrl = read('apps/api/src/modules/identity-and-access/controllers/users.controller.ts');
    expect(ctrl).toContain("@Controller('api/v1/users')");
    expect(ctrl).toContain('@Get()');
    expect(ctrl).toContain("@Get(':id')");
    expect(ctrl).toContain("@Patch(':id')");
    expect(ctrl).toContain("@Post(':id/disable')");
    expect(ctrl).toContain("RequirePermission('user.read')");
    expect(ctrl).toContain("RequirePermission('user.manage')");
    expect(ctrl).toContain('RequireActiveMembershipGuard');
    expect(ctrl).not.toMatch(/@(Put|Delete)\(/);
    expect(ctrl).not.toMatch(/async\s+create\s*\(/);
  });

  it('uses shared cursor pagination helper on list services', () => {
    for (const file of [
      'apps/api/src/modules/tenant-and-billing/application/organizations.service.ts',
      'apps/api/src/modules/identity-and-access/application/memberships.service.ts',
      'apps/api/src/modules/identity-and-access/application/users.service.ts',
    ]) {
      const src = read(file);
      expect(src).toContain('parsePaginationQuery');
      expect(src).toContain('buildPaginatedResponse');
    }
  });

  it('validates cursor as uuid in shared pagination helper', () => {
    const pagination = read('apps/api/src/common/pagination/cursor-pagination.ts');
    expect(pagination).toContain('isUuid');
    expect(pagination).toContain('cursor must be a valid UUID');
  });

  it('documents P6–P12 task records', () => {
    const records = [
      'IMP-001-P6-organizations-list-read.md',
      'IMP-001-P6b-memberships-list-read.md',
      'IMP-001-P6c-tenant-settings-read.md',
      'IMP-001-P7-organizations-get-by-id.md',
      'IMP-001-P7b-memberships-get-by-id.md',
      'IMP-001-P8-list-pagination-filtering.md',
      'IMP-001-P9-users-list-read.md',
      'IMP-001-P11-list-validation-users-detail.md',
      'IMP-001-P12-users-get-by-id.md',
    ];
    for (const name of records) {
      expect(read(`docs/engineering/task-records/${name}`)).toMatch(/Complete/i);
    }
  });
});
