import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('IMP-047 Admin i18n, theme, MVP modules', () => {
  it('ships EN/SW message catalog and preference providers', () => {
    const messages = readFileSync(
      path.join(root, 'apps/web/src/lib/i18n/messages.ts'),
      'utf8',
    );
    expect(messages).toContain("'en'");
    expect(messages).toContain("'sw'");
    expect(messages).toContain('nav.attendance');
    expect(existsSync(path.join(root, 'apps/web/src/components/AppProviders.tsx'))).toBe(true);
    expect(existsSync(path.join(root, 'apps/web/src/components/chrome/AdminChromeControls.tsx'))).toBe(
      true,
    );
  });

  it('tokens define dark theme and chrome controls', () => {
    const tokens = readFileSync(path.join(root, 'apps/web/src/styles/tokens.css'), 'utf8');
    expect(tokens).toContain("[data-theme='dark']");
    expect(tokens).toContain('.admin-console-actions');
  });

  it('AdminShell wires locale/theme controls', () => {
    const shell = readFileSync(path.join(root, 'apps/web/src/components/AdminShell.tsx'), 'utf8');
    expect(shell).toContain('AdminChromeControls');
    expect(shell).toContain('useAppPreferences');
    expect(shell).toContain('navMessageKey');
    expect(shell).toContain('/attendance');
    expect(shell).toContain('/report-cards');
    expect(shell).toContain('/announcements');
    expect(shell).toContain('/reports');
    expect(shell).toContain('/staff');
  });

  it('admin-access exposes MVP nav ids', () => {
    const access = readFileSync(
      path.join(root, 'apps/web/src/lib/auth/admin-access.ts'),
      'utf8',
    );
    for (const id of [
      'staff',
      'attendance',
      'exams',
      'reportCards',
      'announcements',
      'reports',
    ]) {
      expect(access).toContain(`'${id}'`);
    }
    expect(access).toContain("'communications'");
    expect(access).toContain("'insights'");
  });

  it('ships MVP admin routes', () => {
    const base = path.join(root, 'apps/web/src/app/t/[tenantId]/admin');
    for (const segment of [
      'attendance',
      'exams',
      'staff',
      'report-cards',
      'reports',
      'announcements',
    ]) {
      expect(existsSync(path.join(base, segment, 'page.tsx'))).toBe(true);
    }
  });

  it('has task record', () => {
    expect(
      existsSync(path.join(root, 'docs/engineering/task-records/IMP-047-admin-i18n-theme-mvp-nav.md')),
    ).toBe(true);
  });
});
