import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-031 admin cross-links', () => {
  it('DSF-002 documents cross-link map', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-002-admin-guardians.md'),
      'utf8',
    );
    expect(dsf).toContain('IMP-031');
    expect(dsf).toContain('Cross-links');
    expect(dsf).toContain('GET /enrollments?studentId=');
    expect(dsf).toContain('GET /invoices?studentId=');
    expect(dsf).toMatch(/1\.22/);
  });

  it('student detail has enrollments and fees sections', () => {
    const src = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/students/[studentId]/page.tsx'),
      'utf8',
    );
    expect(src).toContain('RelatedRecordsSection');
    expect(src).toContain('Enrollments');
    expect(src).toContain('Fees');
    expect(src).toContain('Guardians');
    expect(src).toContain('buildListQuery');
    expect(src).toContain('visibleAdminNavIds');
    expect(src).toContain('adminEnrollmentPath');
  });

  it('invoice detail links student and lists guardians', () => {
    const src = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/fees/invoices/[invoiceId]/page.tsx'),
      'utf8',
    );
    expect(src).toContain('adminStudentPath');
    expect(src).toContain('Linked guardians');
    expect(src).toContain('/students/${forStudentId}/guardians');
  });

  it('ships admin-path helpers and RelatedRecordsSection', () => {
    expect(
      readFileSync(path.join(root, 'apps/web/src/lib/admin/admin-paths.ts'), 'utf8'),
    ).toContain('adminEnrollmentPath');
    expect(
      readFileSync(
        path.join(root, 'apps/web/src/components/admin/RelatedRecordsSection.tsx'),
        'utf8',
      ),
    ).toContain('RelatedRecordsSection');
  });
});
