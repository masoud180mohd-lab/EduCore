import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-028 admin ops tables', () => {
  it('exports AdminTable and DSF documents ops tables', () => {
    expect(existsSync(path.join(root, 'apps/web/src/components/admin/AdminTable.tsx'))).toBe(true);
    const index = readFileSync(path.join(root, 'apps/web/src/components/admin/index.ts'), 'utf8');
    expect(index).toContain('AdminTable');
    const dsf2 = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf2).toMatch(/1\.18/);
    expect(dsf2).toContain('AdminTable');
    expect(dsf2).toContain('IMP-028');
    const dsf4 = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-004-admin-fees.md'),
      'utf8',
    );
    expect(dsf4).toMatch(/1\.2/);
    expect(dsf4).toContain('AdminTable');
  });

  it('migrates Users Students Invoices Receipts to AdminTable + Load more', () => {
    for (const file of [
      'apps/web/src/app/t/[tenantId]/admin/users/page.tsx',
      'apps/web/src/app/t/[tenantId]/admin/students/page.tsx',
      'apps/web/src/app/t/[tenantId]/admin/fees/invoices/page.tsx',
      'apps/web/src/app/t/[tenantId]/admin/fees/receipts/page.tsx',
    ]) {
      const src = readFileSync(path.join(root, file), 'utf8');
      expect(src, file).toContain('AdminTable');
      expect(src, file).toContain('variant="table"');
      expect(src, file).toContain('ResourceListPagination');
      expect(src, file).not.toMatch(/Link className="card"/);
    }
  });

  it('has task record', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-028-admin-ops-tables.md')),
    ).toBe(true);
  });
});
