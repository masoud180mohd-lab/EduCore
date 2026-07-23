import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-011-PX parent portal bind', () => {
  it('has DBF-011 ACF-013 DSF-006 freezes', () => {
    expect(
      existsSync(
        path.join(root, 'docs/engineering/database-freeze/DBF-011-guardian-portal-bind.md'),
      ),
    ).toBe(true);
    expect(
      existsSync(
        path.join(root, 'docs/engineering/api-contract-freeze/ACF-013-parent-portal-fees.md'),
      ),
    ).toBe(true);
    expect(
      existsSync(path.join(root, 'docs/engineering/design-freeze/DSF-006-parent-portal.md')),
    ).toBe(true);
    const acf = readFileSync(
      path.join(root, 'docs/engineering/api-contract-freeze/ACF-013-parent-portal-fees.md'),
      'utf8',
    );
    expect(acf).toContain('parent.finance.read');
    expect(acf).toContain('/api/v1/me/fees/invoices');
    expect(acf).toContain('PAY-PROVIDER-001');
  });

  it('ships migration and parent permissions', () => {
    expect(
      existsSync(
        path.join(root, 'apps/api/db/migrations/20260723170000_guardian_portal_bind.up.sql'),
      ),
    ).toBe(true);
    const codes = readFileSync(
      path.join(root, 'apps/api/src/common/policy/permission-codes.ts'),
      'utf8',
    );
    expect(codes).toContain('parent.guardian.read');
    expect(codes).toContain('parent.finance.read');
    const roles = readFileSync(
      path.join(root, 'apps/api/src/modules/identity-and-access/rbac/system-roles.ts'),
      'utf8',
    );
    expect(roles).toContain("'parent'");
    expect(roles).toMatch(
      /const PARENT_PERMISSIONS[^=]*=\s*\[[^\]]*'parent\.guardian\.read'[^\]]*'parent\.finance\.read'[^\]]*\]/s,
    );
  });

  it('ships parent shell routes and no MoMo checkout', () => {
    const base = path.join(root, 'apps/web/src/app/t/[tenantId]/parent');
    expect(existsSync(path.join(base, 'page.tsx'))).toBe(true);
    expect(existsSync(path.join(base, 'fees/students/[studentId]/page.tsx'))).toBe(true);
    expect(existsSync(path.join(base, 'fees/invoices/[invoiceId]/page.tsx'))).toBe(true);
    expect(existsSync(path.join(base, 'fees/receipts/[receiptId]/page.tsx'))).toBe(true);
    expect(existsSync(path.join(root, 'apps/web/src/components/ParentShell.tsx'))).toBe(true);
    expect(existsSync(path.join(base, 'pay/page.tsx'))).toBe(false);
  });

  it('parent invoice surface stays read-only', () => {
    const page = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/parent/fees/invoices/[invoiceId]/page.tsx'),
      'utf8',
    );
    expect(page).toContain('/api/v1/me/fees/invoices');
    expect(page).not.toContain('/reconcile');
    expect(page).not.toContain('canRecordPayment');
    expect(page).toContain('PAY-PROVIDER-001');
  });
});
