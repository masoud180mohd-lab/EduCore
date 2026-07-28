import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-025 academic delete dependents', () => {
  it('DSF-002 v1.13 documents dependents banner', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.(?:13|14|15|16|17|18|19|20)/);
    expect(dsf).toContain('IMP-025');
    expect(dsf).toMatch(/dependents banner/i);
  });

  it('Nest maps PG detail to CONFLICT details', () => {
    const helper = readFileSync(
      path.join(
        root,
        'apps/api/src/modules/academic-structure/application/academic-delete-conflict.ts',
      ),
      'utf8',
    );
    expect(helper).toContain('mapAcademicDeleteDependentsConflict');
    expect(helper).toContain('dependents');
  });

  it('Admin year detail shows DeleteDependentsBanner', () => {
    const page = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/academic/years/[yearId]/page.tsx'),
      'utf8',
    );
    expect(page).toContain('DeleteDependentsBanner');
    expect(page).toContain('parseDeleteDependents');
  });

  it('has migration and task record', () => {
    expect(
      existsSync(
        path.join(
          root,
          'apps/api/db/migrations/20260727140000_academic_delete_dependents_detail.up.sql',
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        path.join(root, 'docs/engineering/task-records/IMP-025-academic-delete-dependents.md'),
      ),
    ).toBe(true);
  });
});
