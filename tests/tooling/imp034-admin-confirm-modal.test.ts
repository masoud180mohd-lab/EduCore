import { describe, expect, it } from 'vitest';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTsx(full));
    else if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(full);
  }
  return out;
}

const ADMIN_MUST_PATHS = [
  'apps/web/src/app/t/[tenantId]/admin/fees/invoices/[invoiceId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/users/[userId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/guardians/[guardianId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/organizations/[organizationId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/years/[yearId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/terms/[termId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/classes/[classId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/streams/[streamId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/subjects/[subjectId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/admin/academic/enrollments/[enrollmentId]/page.tsx',
] as const;

const TEACHER_MUST_PATHS = [
  'apps/web/src/app/t/[tenantId]/teacher/marks/subjects/[examSubjectId]/page.tsx',
  'apps/web/src/app/t/[tenantId]/teacher/attendance/sessions/[sessionId]/page.tsx',
] as const;

describe('IMP-034 admin ConfirmDialog', () => {
  it('hardens ConfirmDialog with Esc + focus-cancel + restore', () => {
    const src = readFileSync(
      path.join(root, 'apps/web/src/components/admin/ConfirmDialog.tsx'),
      'utf8',
    );
    expect(src).toContain('Escape');
    expect(src).toContain('cancelRef');
    expect(src).toContain('previouslyFocused');
    expect(src).toContain('alertdialog');
  });

  it('migrated admin money/membership/destructive paths have zero window.confirm', () => {
    for (const rel of ADMIN_MUST_PATHS) {
      const src = readFileSync(path.join(root, rel), 'utf8');
      expect(src, rel).not.toContain('window.confirm');
      expect(src, rel).toContain('ConfirmDialog');
    }
  });

  it('admin tree has no window.confirm', () => {
    const adminRoot = path.join(root, 'apps/web/src/app/t/[tenantId]/admin');
    const offenders: string[] = [];
    for (const file of walkTsx(adminRoot)) {
      const src = readFileSync(file, 'utf8');
      if (src.includes('window.confirm')) {
        offenders.push(path.relative(root, file).replace(/\\/g, '/'));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('teacher marks submit and attendance close use ConfirmDialog (Wave X)', () => {
    for (const rel of TEACHER_MUST_PATHS) {
      const src = readFileSync(path.join(root, rel), 'utf8');
      expect(src, rel).not.toContain('window.confirm');
      expect(src, rel).toContain('ConfirmDialog');
    }
  });

  it('teacher tree has no window.confirm', () => {
    const teacherRoot = path.join(root, 'apps/web/src/app/t/[tenantId]/teacher');
    const offenders: string[] = [];
    for (const file of walkTsx(teacherRoot)) {
      const src = readFileSync(file, 'utf8');
      if (src.includes('window.confirm')) {
        offenders.push(path.relative(root, file).replace(/\\/g, '/'));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('DSF-002 documents ConfirmDialog rules', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toContain('IMP-034');
    expect(dsf).toContain('ConfirmDialog');
    expect(dsf).toMatch(/Esc/);
  });
});
