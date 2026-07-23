import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-011 parent/guardian fees (read-only)', () => {
  it('has provisional DSF-005', () => {
    const dsf = path.join(root, 'docs/engineering/design-freeze/DSF-005-parent-guardian-fees.md');
    expect(existsSync(dsf)).toBe(true);
    const text = readFileSync(dsf, 'utf8');
    expect(text).toMatch(/solo-operator provisional/i);
    expect(text).toMatch(/read-only/i);
    expect(text).toContain('PAY-PROVIDER-001');
    expect(text).toMatch(/linked students/i);
    expect(text).toMatch(/Admin compose/i);
  });

  it('ships guardian fees routes', () => {
    const base = path.join(root, 'apps/web/src/app/t/[tenantId]/admin/guardians/[guardianId]/fees');
    expect(existsSync(path.join(base, 'page.tsx'))).toBe(true);
    expect(existsSync(path.join(base, 'students/[studentId]/page.tsx'))).toBe(true);
    expect(existsSync(path.join(base, 'invoices/[invoiceId]/page.tsx'))).toBe(true);
    expect(existsSync(path.join(base, 'receipts/[receiptId]/page.tsx'))).toBe(true);
  });

  it('has isolation helpers and no parent MoMo checkout route', () => {
    expect(existsSync(path.join(root, 'apps/web/src/lib/finance/guardian-fees-access.ts'))).toBe(
      true,
    );
    const helper = readFileSync(
      path.join(root, 'apps/web/src/lib/finance/guardian-fees-access.ts'),
      'utf8',
    );
    expect(helper).toContain('activeLinkedStudentIds');
    expect(helper).toContain('guardianFeesMutationsAllowed');

    expect(existsSync(path.join(root, 'apps/web/src/app/t/[tenantId]/parent/fees/page.tsx'))).toBe(
      false,
    );
    expect(existsSync(path.join(root, 'apps/web/src/app/t/[tenantId]/parent/pay/page.tsx'))).toBe(
      false,
    );
  });

  it('guardian fees invoice surface has no bursar mutate controls', () => {
    const page = readFileSync(
      path.join(
        root,
        'apps/web/src/app/t/[tenantId]/admin/guardians/[guardianId]/fees/invoices/[invoiceId]/page.tsx',
      ),
      'utf8',
    );
    expect(page).toMatch(/read-only/i);
    expect(page).toContain('PAY-PROVIDER-001');
    expect(page).not.toMatch(/\/issue\b/);
    expect(page).not.toMatch(/\/void\b/);
    expect(page).not.toMatch(/\/payments['"]\s*,\s*\{\s*method:\s*['"]POST/);
    expect(page).not.toContain('/reconcile');
    expect(page).not.toContain('canIssueInvoice');
    expect(page).not.toContain('canRecordPayment');
  });

  it('links fees entry from guardian detail', () => {
    const detail = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/guardians/[guardianId]/page.tsx'),
      'utf8',
    );
    expect(detail).toContain('/fees');
    expect(detail).toMatch(/View fees/i);
  });
});
