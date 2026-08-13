import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('F-008 product write isolation', () => {
  it('ships a live suite covering attendance, marks, invoice, and webhook writes', () => {
    const live = path.join(root, 'tests/isolation/product-writes.live.test.ts');
    expect(existsSync(live)).toBe(true);
    const src = readFileSync(live, 'utf8');
    expect(src).toContain('create_attendance_session');
    expect(src).toContain('upsert_marks');
    expect(src).toContain('create_invoice_draft');
    expect(src).toContain('issue_invoice');
    expect(src).toContain('ingest_clickpesa_gateway_event');
    expect(src).toContain('INSERT INTO attendance_sessions');
    expect(src).toContain('INSERT INTO marks');
    expect(src).toContain('INSERT INTO invoices');
    expect(src).toContain('INSERT INTO payment_gateway_events');
  });
});
