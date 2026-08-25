import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-048 dashboard KPIs, Students/Fees i18n, report-card PDF', () => {
  it('registers owning-module summary routes before :id', () => {
    const students = readFileSync(
      path.join(root, 'apps/api/src/modules/student-registry/controllers/students.controller.ts'),
      'utf8',
    );
    expect(students.indexOf("@Get('summary')")).toBeLessThan(students.indexOf("@Get(':id')"));
    const invoices = readFileSync(
      path.join(root, 'apps/api/src/modules/finance-ledger/controllers/invoices.controller.ts'),
      'utf8',
    );
    expect(invoices).toContain("@Get('api/v1/invoices/summary')");
    expect(invoices.indexOf('invoices/summary')).toBeLessThan(invoices.indexOf(':invoiceId'));
    const attendance = readFileSync(
      path.join(root, 'apps/api/src/modules/attendance/controllers/attendance.controller.ts'),
      'utf8',
    );
    expect(attendance.indexOf("@Get('summary')")).toBeLessThan(attendance.indexOf("@Get(':id')"));
  });

  it('ships report-card JSON and PDF routes', () => {
    const marks = readFileSync(
      path.join(root, 'apps/api/src/modules/assessment/controllers/marks.controller.ts'),
      'utf8',
    );
    expect(marks).toContain("Get('api/v1/exams/:examId/report-cards')");
    expect(marks).toContain("Get('api/v1/exams/:examId/report-cards/:studentId/pdf')");
    expect(
      existsSync(path.join(root, 'apps/api/src/modules/assessment/application/report-card-pdf.ts')),
    ).toBe(true);
  });

  it('admin home renders KPI grid and translated Students/Fees chrome', () => {
    const home = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/page.tsx'),
      'utf8',
    );
    expect(home).toContain("aria-label={t('common.dashboard')}");
    expect(home).toContain('grid gap-3 sm:grid-cols-2 xl:grid-cols-4');
    expect(home).toContain('/api/v1/students/summary');
    expect(home).toContain('/api/v1/invoices/summary');
    expect(home).toContain('/api/v1/attendance-sessions/summary');
    const students = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/students/page.tsx'),
      'utf8',
    );
    expect(students).toContain("t('students.title')");
    const fees = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/fees/page.tsx'),
      'utf8',
    );
    expect(fees).toContain("t('fees.title')");
    const messages = readFileSync(path.join(root, 'apps/web/src/lib/i18n/messages.ts'), 'utf8');
    expect(messages).toContain("'students.title'");
    expect(messages).toContain("'fees.invoicesTitle'");
  });

  it('report-cards UI downloads PDF', () => {
    const page = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/report-cards/page.tsx'),
      'utf8',
    );
    expect(page).toContain('apiDownload');
    expect(page).toContain('/report-cards/');
    expect(
      existsSync(
        path.join(
          root,
          'apps/web/src/app/t/[tenantId]/admin/report-cards/[examId]/[studentId]/page.tsx',
        ),
      ),
    ).toBe(true);
    const tokens = readFileSync(path.join(root, 'apps/web/src/styles/tokens.css'), 'utf8');
    expect(tokens).toContain('.kpi-grid');
    expect(tokens).toContain('@media print');
  });

  it('has task record', () => {
    expect(
      existsSync(
        path.join(
          root,
          'docs/engineering/task-records/IMP-048-dashboard-kpis-i18n-report-cards.md',
        ),
      ),
    ).toBe(true);
  });
});
