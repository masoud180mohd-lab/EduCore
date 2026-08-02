/** PAY-006 structural: DSF-004 status UI + invoice sync-provider paths. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('PAY-006 payment status UI', () => {
  it('DSF-004 documents pending MoMo, Sync vs Reconcile, Fake honesty', () => {
    const dsf = readFileSync(
      path.join(root, 'docs/engineering/design-freeze/DSF-004-admin-fees.md'),
      'utf8',
    );
    expect(dsf).toContain('Version');
    expect(dsf).toMatch(/1\.5/);
    expect(dsf).toContain('Refresh from provider');
    expect(dsf).toContain('Sync vs Reconcile');
    expect(dsf).toContain('Fake');
    expect(dsf).toContain('Parent portal pay');
  });

  it('invoice detail calls sync-provider and mobile-money paths', () => {
    const page = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/fees/invoices/[invoiceId]/page.tsx'),
      'utf8',
    );
    expect(page).toContain('/api/v1/payments/${paymentId}/sync-provider');
    expect(page).toContain('/api/v1/payments/mobile-money');
    expect(page).toContain('Refresh from provider');
    expect(page).toContain('Request mobile money');
    expect(page).toContain('canSyncProviderPayment');
    expect(page).toContain('Reconcile');
  });

  it('fees hub can batch sync-provider-pending', () => {
    const hub = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/fees/page.tsx'),
      'utf8',
    );
    expect(hub).toContain('/api/v1/payments/sync-provider-pending');
    expect(hub).toContain('Sync pending (tenant)');
  });
});
