import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-011-PX1 parent demo path', () => {
  it('DSF-006 documents user picker bind UX', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-006-parent-portal.md'),
      'utf8',
    );
    expect(dsf).toMatch(/1\.1/);
    expect(dsf).toContain('GET /api/v1/users');
    expect(dsf).toMatch(/picker|select/i);
    expect(dsf).toContain('PAY-PROVIDER-001');
  });

  it('ships seed:parent-demo script and npm script', () => {
    expect(existsSync(path.join(root, 'scripts/seed-parent-demo.ts'))).toBe(true);
    const pkg = readFileSync(path.join(root, 'package.json'), 'utf8');
    expect(pkg).toContain('"seed:parent-demo"');
    const seed = readFileSync(path.join(root, 'scripts/seed-parent-demo.ts'), 'utf8');
    expect(seed).toContain('SEED_PARENT_PASS');
    expect(seed).toContain('bind_guardian_user');
    expect(seed).toContain('EDUCORE_APP_DATABASE_URL');
    expect(seed).toContain('PAY-PROVIDER-001');
  });

  it('guardian detail uses user list for bind primary UX', () => {
    const page = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/guardians/[guardianId]/page.tsx'),
      'utf8',
    );
    expect(page).toContain('/api/v1/users?limit=50');
    expect(page).toContain('bindUserSelect');
    expect(page).toContain('formatUserBindLabel');
    expect(page).toContain('Advanced: paste user UUID');
    expect(page).toContain('showAdvancedUuid');
    // Primary label is School user + select, not UUID-only primary
    expect(page).toContain('htmlFor="bindUserSelect"');
    expect(page).toMatch(/label htmlFor="bindUserSelect">School user<\/label>/);
  });

  it('has manual QA checklist', () => {
    expect(existsSync(path.join(root, 'tasks/manual-test-parent-demo-qa.md'))).toBe(true);
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-011-PX1-parent-demo-path.md')),
    ).toBe(true);
  });
});
