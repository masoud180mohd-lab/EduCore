import { describe, expect, it } from 'vitest';

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('COMMS-006 notifications admin UI', () => {
  it('ships notifications page with deliveries + send + usage', () => {
    const src = readFileSync(
      path.join(root, 'apps/web/src/app/t/[tenantId]/admin/notifications/page.tsx'),
      'utf8',
    );
    expect(src).toContain('/api/v1/notifications/deliveries');
    expect(src).toContain('/api/v1/notifications/usage');
    expect(src).toContain('/api/v1/notifications/requests');
    expect(src).toContain('/api/v1/notification-templates');
    expect(src).toContain('ConfirmDialog');
    expect(src).toContain('idempotencyKey');
    expect(src).toContain('formatPhoneLast4');
    expect(src).not.toContain('window.confirm');
    const types = readFileSync(path.join(root, 'apps/web/src/lib/notifications/types.ts'), 'utf8');
    expect(types).toContain('····');
  });

  it('gates nav on notification.read', () => {
    const access = readFileSync(path.join(root, 'apps/web/src/lib/auth/admin-access.ts'), 'utf8');
    expect(access).toContain("'notifications'");
    expect(access).toContain('notification.read');
    expect(access).toContain('canNotificationManage');
    const shell = readFileSync(path.join(root, 'apps/web/src/components/AdminShell.tsx'), 'utf8');
    expect(shell).toContain('/notifications');
    expect(shell).toContain("id: 'notifications'");
  });

  it('has task record and never documents full MSISDN in UI', () => {
    const record = path.join(
      root,
      'docs/engineering/task-records/COMMS-006-notifications-admin-ui.md',
    );
    expect(existsSync(record)).toBe(true);
    const md = readFileSync(record, 'utf8');
    expect(md).toContain('phoneLast4');
    expect(md).toContain('Idempotency-Key');
    expect(md).toContain('notification.read');
  });
});
