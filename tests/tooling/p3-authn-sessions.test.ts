import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('IMP-001 P3 AuthN sessions structure', () => {
  it('ships sessions migration with RLS and auth helpers', () => {
    const up = 'apps/api/db/migrations/20260715020000_sessions.up.sql';
    expect(existsSync(path.join(root, up))).toBe(true);
    const sql = read(up);
    expect(sql).toContain('CREATE TABLE sessions');
    expect(sql).toContain('session_token_hash');
    expect(sql).toContain('refresh_token_hash');
    expect(sql).toContain('enable_tenant_rls');
    expect(sql).toContain('app.auth_create_session');
    expect(sql).toContain('app.auth_find_session_by_access_hash');
    expect(sql).toContain('SECURITY DEFINER');
  });

  it('exposes only auth routes under /api/v1/auth (login/refresh/logout/me/select-tenant)', () => {
    const ctrl = read('apps/api/src/modules/identity-and-access/controllers/auth.controller.ts');
    expect(ctrl).toContain("@Controller('api/v1/auth')");
    expect(ctrl).toContain("@Post('login')");
    expect(ctrl).toContain("@Post('refresh')");
    expect(ctrl).toContain("@Post('logout')");
    expect(ctrl).toContain("@Get('me')");
    expect(ctrl).toContain("@Post('select-tenant')");
    expect(ctrl).toContain('setRefreshCookie');
    expect(ctrl).toContain('clearRefreshCookie');
    expect(ctrl).not.toMatch(/@(Get|Post|Put|Patch|Delete)\(['"]tenants/);
    expect(ctrl).not.toMatch(/@(Get|Post|Put|Patch|Delete)\(['"]users/);
  });

  it('wires SessionTokenValidator inside IdentityAndAccessModule (private repo)', () => {
    const mod = read('apps/api/src/modules/identity-and-access/identity-and-access.module.ts');
    expect(mod).toContain('SessionTokenValidator');
    expect(mod).toContain('RejectAllTokenValidator');
    expect(mod).toContain('TOKEN_VALIDATOR');
    expect(mod).toContain('SessionRepository');
    const barrel = read('apps/api/src/modules/identity-and-access/index.ts');
    expect(barrel).not.toMatch(/from '\.\/repositories\//);
  });

  it('keeps common free of module imports for session validator', () => {
    const platform = read('apps/api/src/common/request-platform/request-platform.module.ts');
    expect(platform).not.toContain('identity-and-access');
    expect(platform).not.toContain('SessionRepository');
  });

  it('has P3 task record', () => {
    expect(
      existsSync(
        path.join(root, 'docs/engineering/task-records/IMP-001-P3-authn-sessions-login.md'),
      ),
    ).toBe(true);
  });
});
