import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

const openApiPath = path.join(
  root,
  'docs/engineering/api-contract-freeze/openapi/acf-012-finance-fees.openapi.yaml',
);

function loadOpenApi(): {
  paths?: Record<
    string,
    Record<
      string,
      {
        'x-authz'?: { stack?: string[]; permissionCodes?: string[] };
      }
    >
  >;
} {
  return load(readFileSync(openApiPath, 'utf8')) as ReturnType<typeof loadOpenApi>;
}

function permissionCodes(pathKey: string, method: string): string[] {
  return loadOpenApi().paths?.[pathKey]?.[method]?.['x-authz']?.permissionCodes ?? [];
}

function authzStack(pathKey: string, method: string): string[] {
  return loadOpenApi().paths?.[pathKey]?.[method]?.['x-authz']?.stack ?? [];
}

describe('IMP-009 finance fees foundation', () => {
  it('has provisional DBF-012 ACF-012 and PAY-PROVIDER-001', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/database-freeze/DBF-012-finance-fees-slice.md')),
    ).toBe(true);
    expect(
      existsSync(
        path.join(root, 'docs/engineering/api-contract-freeze/ACF-012-finance-fees-slice.md'),
      ),
    ).toBe(true);
    expect(existsSync(path.join(root, 'docs/engineering/decisions/PAY-PROVIDER-001.md'))).toBe(
      true,
    );
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-009-finance-fees-program.md')),
    ).toBe(true);
  });

  it('registers finance permissions and staff lacks reconcile', () => {
    const codes = readFileSync(
      path.join(root, 'apps/api/src/common/policy/permission-codes.ts'),
      'utf8',
    );
    expect(codes).toContain("'finance.read'");
    expect(codes).toContain("'finance.manage'");
    expect(codes).toContain("'finance.reconcile'");

    const roles = readFileSync(
      path.join(root, 'apps/api/src/modules/identity-and-access/rbac/system-roles.ts'),
      'utf8',
    );
    expect(roles).toContain("'finance.read'");
    expect(roles).toContain("'finance.manage'");
    // staff baseline must not include reconcile (owner/admin get it via full catalogue)
    const staffBlock = roles.slice(
      roles.indexOf('const STAFF_PERMISSIONS'),
      roles.indexOf('export const SYSTEM_ROLE_DEFINITIONS'),
    );
    expect(staffBlock).not.toContain("'finance.reconcile'");
  });

  it('ships product controllers with RequirePermission', () => {
    const feeStructures = readFileSync(
      path.join(
        root,
        'apps/api/src/modules/finance-ledger/controllers/fee-structures.controller.ts',
      ),
      'utf8',
    );
    expect(feeStructures).toContain("RequirePermission('finance.read')");
    expect(feeStructures).toContain("RequirePermission('finance.manage')");

    const invoices = readFileSync(
      path.join(root, 'apps/api/src/modules/finance-ledger/controllers/invoices.controller.ts'),
      'utf8',
    );
    expect(invoices).toContain("Post('api/v1/invoices/:invoiceId/issue')");
    expect(invoices).toContain("Post('api/v1/invoices/:invoiceId/void')");

    const payments = readFileSync(
      path.join(root, 'apps/api/src/modules/payments/controllers/payments.product.controller.ts'),
      'utf8',
    );
    expect(payments).toContain("Post('api/v1/payments')");
    expect(payments).toContain("Post('api/v1/payments/:paymentId/reverse')");
    expect(payments).toContain("Post('api/v1/payments/:paymentId/reconcile')");
    expect(payments).toContain("RequirePermission('finance.reconcile')");
    expect(payments).toContain("Get('api/v1/receipts')");

    const webhooks = readFileSync(
      path.join(root, 'apps/api/src/modules/payments/controllers/payments.webhooks.controller.ts'),
      'utf8',
    );
    expect(webhooks).toContain("Post('api/v1/payments/webhooks/fake')");
    expect(webhooks).toContain("RequirePermission('finance.manage')");
  });

  it('migrations: SELECT-only finance tables + SECURITY DEFINER helpers', () => {
    const create = readFileSync(
      path.join(root, 'apps/api/db/migrations/20260721160000_finance_fees_create.up.sql'),
      'utf8',
    );
    expect(create).toContain('GRANT SELECT ON TABLE chart_of_accounts');
    expect(create).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE chart_of_accounts');
    expect(create).toContain("'finance.read'");
    expect(create).toContain("'finance.manage'");
    expect(create).toContain("'finance.reconcile'");
    expect(create).not.toMatch(/CREATE TABLE invoices[\s\S]*balance\s+/i);

    const helpers = readFileSync(
      path.join(root, 'apps/api/db/migrations/20260721160100_finance_fees_write_helpers.up.sql'),
      'utf8',
    );
    expect(helpers).toMatch(/SECURITY DEFINER/i);
    expect(helpers).toContain('app.issue_invoice');
    expect(helpers).toContain('app.post_manual_payment');

    const voidReverse = readFileSync(
      path.join(root, 'apps/api/db/migrations/20260721160200_finance_void_reverse_helpers.up.sql'),
      'utf8',
    );
    expect(voidReverse).toContain('app.void_invoice');
    expect(voidReverse).toContain('app.reverse_payment');
    expect(voidReverse).toMatch(/SECURITY DEFINER/i);

    const gateway = readFileSync(
      path.join(root, 'apps/api/db/migrations/20260721160300_finance_gateway_event_helpers.up.sql'),
      'utf8',
    );
    expect(gateway).toContain('app.record_gateway_event');
  });

  it('binds PAYMENT_PROVIDER_PORT to Fake only', () => {
    const mod = readFileSync(
      path.join(root, 'apps/api/src/modules/payments/payments.module.ts'),
      'utf8',
    );
    expect(mod).toContain('PAYMENT_PROVIDER_PORT');
    expect(mod).toContain('FakePaymentProvider');
    expect(mod).toContain('useExisting: FakePaymentProvider');
  });

  it('OpenAPI ACF-012 covers finance paths with session_tenant_bind', () => {
    const paths = Object.keys(loadOpenApi().paths ?? {});
    for (const p of [
      '/fee-structures',
      '/fee-structures/{feeStructureId}',
      '/invoices',
      '/invoices/{invoiceId}',
      '/invoices/{invoiceId}/issue',
      '/invoices/{invoiceId}/void',
      '/invoices/{invoiceId}/payments',
      '/payments',
      '/payments/{paymentId}',
      '/payments/{paymentId}/reverse',
      '/payments/{paymentId}/reconcile',
      '/payments/webhooks/fake',
      '/receipts',
      '/receipts/{receiptId}',
    ]) {
      expect(paths, `missing ${p}`).toContain(p);
    }
    expect(permissionCodes('/fee-structures', 'get')).toContain('finance.read');
    expect(permissionCodes('/payments', 'post')).toContain('finance.manage');
    expect(permissionCodes('/invoices/{invoiceId}/void', 'post')).toContain('finance.manage');
    expect(permissionCodes('/payments/{paymentId}/reconcile', 'post')).toContain(
      'finance.reconcile',
    );
    expect(authzStack('/invoices/{invoiceId}', 'get')).toContain('session_tenant_bind');
    expect(permissionCodes('/payments/webhooks/fake', 'post')).toContain('finance.manage');
  });
});
