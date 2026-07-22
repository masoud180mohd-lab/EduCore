import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-010 admin fees UI', () => {
  it('has provisional DSF-004', () => {
    const dsf = path.join(root, 'docs/engineering/design-freeze/DSF-004-admin-fees.md');
    expect(existsSync(dsf)).toBe(true);
    const text = readFileSync(dsf, 'utf8');
    expect(text).toMatch(/solo-operator provisional/i);
    expect(text).toContain('amountMinor');
    expect(text).toMatch(/MoMo|Mobile money/i);
    expect(text).toContain('scale 100');
  });

  it('registers Fees in AdminShell', () => {
    const shell = readFileSync(path.join(root, 'apps/web/src/components/AdminShell.tsx'), 'utf8');
    expect(shell).toContain("label: 'Fees'");
    expect(shell).toContain('/fees');
  });

  it('ships fees routes', () => {
    const base = path.join(root, 'apps/web/src/app/t/[tenantId]/admin/fees');
    expect(existsSync(path.join(base, 'page.tsx'))).toBe(true);
    expect(existsSync(path.join(base, 'structures/page.tsx'))).toBe(true);
    expect(existsSync(path.join(base, 'structures/[structureId]/page.tsx'))).toBe(true);
    expect(existsSync(path.join(base, 'invoices/page.tsx'))).toBe(true);
    expect(existsSync(path.join(base, 'invoices/[invoiceId]/page.tsx'))).toBe(true);
    expect(existsSync(path.join(base, 'receipts/page.tsx'))).toBe(true);
    expect(existsSync(path.join(base, 'receipts/[receiptId]/page.tsx'))).toBe(true);
  });

  it('has money and action helpers', () => {
    expect(existsSync(path.join(root, 'apps/web/src/lib/finance/money.ts'))).toBe(true);
    expect(existsSync(path.join(root, 'apps/web/src/lib/finance/invoice-actions.ts'))).toBe(true);
    const money = readFileSync(path.join(root, 'apps/web/src/lib/finance/money.ts'), 'utf8');
    expect(money).toContain('TZS_MINOR_SCALE');
    expect(money).toContain('100');
  });

  it('depends on ACF-012 finance OpenAPI', () => {
    expect(
      existsSync(
        path.join(
          root,
          'docs/engineering/api-contract-freeze/openapi/acf-012-finance-fees.openapi.yaml',
        ),
      ),
    ).toBe(true);
  });
});
