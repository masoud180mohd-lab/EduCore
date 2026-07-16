import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const migrationsDir = path.join(projectRoot, 'apps/api/db/migrations');
const openApiPath = path.join(
  projectRoot,
  'docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml',
);

function readMigration(name: string): string {
  return readFileSync(path.join(migrationsDir, name), 'utf8');
}

describe('IMP-001 P1 tenant_memberships + OpenAPI hardening', () => {
  it('creates tenant_memberships with DBF-001 columns and constraints', () => {
    const ddl = readMigration('20260714180000_tenant_memberships.up.sql');
    expect(ddl).toMatch(/CREATE TABLE tenant_memberships/i);
    expect(ddl).toMatch(/tenant_id uuid NOT NULL REFERENCES tenants/i);
    expect(ddl).toMatch(/user_id uuid NOT NULL REFERENCES users/i);
    expect(ddl).toMatch(/uq_tenant_memberships_tenant_user/i);
    expect(ddl).toMatch(/invited.*active.*suspended.*removed/is);
    expect(ddl).toMatch(/REVOKE INSERT, DELETE ON TABLE tenant_memberships FROM educore_app/i);
  });

  it('redefines membership helpers with SECURITY DEFINER and real EXISTS', () => {
    const rls = readMigration('20260714190000_membership_rls_helpers.up.sql');
    expect(rls).toMatch(/app\.enable_tenant_rls\('tenant_memberships'/i);
    expect(rls).toMatch(/SECURITY DEFINER/i);
    expect(rls).toMatch(/FROM tenant_memberships/i);
    expect(rls).toMatch(/status = 'active'/i);
    expect(rls).toMatch(/user_is_member_of_current_tenant/i);
    expect(rls).toMatch(/CREATE POLICY rls_tenant_memberships_select/i);
    // Stub must be gone from this migration body (no permanent false-only membership).
    expect(rls).not.toMatch(/SELECT false\s+AND target_tenant_id/i);
  });

  it('pairs up/down for new migrations', () => {
    const files = readdirSync(migrationsDir);
    for (const id of [
      '20260714180000_tenant_memberships',
      '20260714190000_membership_rls_helpers',
    ]) {
      expect(files).toContain(`${id}.up.sql`);
      expect(files).toContain(`${id}.down.sql`);
    }
  });

  it('hardens OpenAPI with securitySchemes, default security, and x-permissions', () => {
    const doc = load(readFileSync(openApiPath, 'utf8')) as {
      security?: unknown;
      info?: { description?: string };
      components?: {
        'securitySchemes'?: Record<string, unknown>;
        'x-permission-catalogue'?: { codes?: string[] };
      };
      paths?: Record<
        string,
        Record<string, { 'operationId'?: string; 'security'?: unknown; 'x-permissions'?: string[] }>
      >;
    };

    expect(doc.info?.description?.toLowerCase()).toMatch(
      /accepted freeze v1\.0|solo-operator|implementation-gated/,
    );
    expect(doc.components?.securitySchemes?.['bearerAuth']).toBeTruthy();
    expect(doc.components?.securitySchemes?.['tenantHeader']).toBeTruthy();
    expect(doc.security).toEqual([{ bearerAuth: [] }]);
    expect(doc.components?.['x-permission-catalogue']?.codes).toContain('user.invite');

    const createMembership = doc.paths?.['/memberships']?.['post'];
    expect(createMembership?.['x-permissions']).toEqual(['user.invite']);
    expect(createMembership?.security).toEqual([{ bearerAuth: [], tenantHeader: [] }]);

    const login = doc.paths?.['/auth/login']?.['post'];
    expect(login?.security).toEqual([]);
    expect(login?.['x-permissions']).toEqual([]);
  });
});
