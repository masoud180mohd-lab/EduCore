import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('IMP-001 migration tooling', () => {
  it('ships paired migrations for every up file', () => {
    const dir = path.join(projectRoot, 'apps/api/db/migrations');
    expect(existsSync(dir)).toBe(true);

    const files = readdirSync(dir);
    const up = files.filter((f) => f.endsWith('.up.sql'));
    expect(up.length).toBeGreaterThan(0);

    for (const file of up) {
      const id = file.replace(/\.up\.sql$/u, '');
      expect(files).toContain(`${id}.down.sql`);
    }
  });

  it('keeps baseline free of domain catalogs', () => {
    const baseline = read(
      'apps/api/db/migrations/20260714100000_baseline_meta.up.sql',
    ).toLowerCase();
    expect(baseline).toContain('schema_migrations');
    expect(baseline).not.toMatch(/create table\s+permissions/u);
    expect(baseline).not.toMatch(/create table\s+plans/u);
  });

  it('documents migrator vs app vs platform roles and FORCE RLS intent', () => {
    const bootstrap = read('apps/api/db/bootstrap/001_roles.sql');
    expect(bootstrap).toContain('educore_migrator');
    expect(bootstrap).toContain('educore_app');
    expect(bootstrap).toContain('educore_platform');
    expect(bootstrap.toLowerCase()).toContain('force rls');

    const readme = read('apps/api/db/README.md').toLowerCase();
    expect(readme).toContain('educore_app');
    expect(readme).toContain('migrator');
    expect(readme).toMatch(/never/);
  });

  it('exposes db migrate scripts on the workspace', () => {
    const manifest = JSON.parse(read('package.json')) as {
      scripts?: Record<string, string>;
    };
    expect(manifest.scripts?.['db:migrate']).toContain('db-migrate');
    expect(manifest.scripts?.['db:migrate:down']).toContain('--down');
    expect(manifest.scripts?.['db:bootstrap-roles']).toContain('db-bootstrap-roles');
  });

  it('records P0 go/no-go gate', () => {
    const gate = read('docs/engineering/gates/IMP-001-P0-go-no-go.md');
    expect(gate).toContain('CONDITIONAL GO');
    expect(gate).toContain('P0');
  });

  it('ships P14/P15 product write SECURITY DEFINER helpers', () => {
    const up = read('apps/api/db/migrations/20260720140000_product_write_helpers.up.sql');
    expect(up).toContain('app.replace_tenant_settings');
    expect(up).toContain('app.invite_tenant_membership');
    expect(up).toContain('app.assign_system_role_codes');
    expect(up).toMatch(/SECURITY DEFINER/i);
    expect(up).toContain('GRANT EXECUTE');
    const down = read('apps/api/db/migrations/20260720140000_product_write_helpers.down.sql');
    expect(down).toContain('DROP FUNCTION');
  });

  it('ships P16/P17 org create + user displayName helpers', () => {
    const up = read('apps/api/db/migrations/20260720150000_org_create_user_patch_helpers.up.sql');
    expect(up).toContain('app.create_organization');
    expect(up).toContain('app.update_user_display_name');
    expect(up).toMatch(/SECURITY DEFINER/i);
    const down = read(
      'apps/api/db/migrations/20260720150000_org_create_user_patch_helpers.down.sql',
    );
    expect(down).toContain('DROP FUNCTION');
  });

  it('ships IMP-002 students list table SELECT-only for educore_app', () => {
    const up = read('apps/api/db/migrations/20260720160000_students_list_read.up.sql');
    expect(up).toMatch(/CREATE TABLE students/i);
    expect(up).toContain('student.read');
    expect(up).toContain('GRANT SELECT ON TABLE students TO educore_app');
    expect(up).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE students FROM educore_app');
    const down = read('apps/api/db/migrations/20260720160000_students_list_read.down.sql');
    expect(down).toContain('DROP TABLE IF EXISTS students');
  });

  it('ships IMP-002-P2 create_student helper + student.manage', () => {
    const up = read('apps/api/db/migrations/20260720170000_students_create.up.sql');
    expect(up).toContain('app.create_student');
    expect(up).toMatch(/SECURITY DEFINER/i);
    expect(up).toContain('student.manage');
    expect(up).toContain('GRANT EXECUTE');
    const down = read('apps/api/db/migrations/20260720170000_students_create.down.sql');
    expect(down).toContain('DROP FUNCTION');
  });

  it('ships IMP-003 academic_years list table SELECT-only for educore_app', () => {
    const up = read('apps/api/db/migrations/20260720180000_academic_years_list_read.up.sql');
    expect(up).toMatch(/CREATE TABLE academic_years/i);
    expect(up).toContain('academic.read');
    expect(up).toContain('GRANT SELECT ON TABLE academic_years TO educore_app');
    expect(up).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE academic_years FROM educore_app');
    const down = read('apps/api/db/migrations/20260720180000_academic_years_list_read.down.sql');
    expect(down).toContain('DROP TABLE IF EXISTS academic_years');
  });

  it('ships IMP-003-P2 create_academic_year helper + academic.manage', () => {
    const up = read('apps/api/db/migrations/20260720190000_academic_years_create.up.sql');
    expect(up).toContain('app.create_academic_year');
    expect(up).toMatch(/SECURITY DEFINER/i);
    expect(up).toContain('academic.manage');
    expect(up).toContain('GRANT EXECUTE');
    const down = read('apps/api/db/migrations/20260720190000_academic_years_create.down.sql');
    expect(down).toContain('DROP FUNCTION');
  });

  it('ships IMP-003-P3 terms list table SELECT-only for educore_app', () => {
    const up = read('apps/api/db/migrations/20260720200000_terms_list_read.up.sql');
    expect(up).toMatch(/CREATE TABLE terms/i);
    expect(up).toContain('REFERENCES academic_years (id)');
    expect(up).toContain('GRANT SELECT ON TABLE terms TO educore_app');
    expect(up).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE terms FROM educore_app');
    expect(up).not.toMatch(/INSERT INTO permissions/i);
    const down = read('apps/api/db/migrations/20260720200000_terms_list_read.down.sql');
    expect(down).toContain('DROP TABLE IF EXISTS terms');
  });

  it('ships IMP-003-P5 create_term helper (no new permission seed)', () => {
    const up = read('apps/api/db/migrations/20260720210000_terms_create.up.sql');
    expect(up).toContain('app.create_term');
    expect(up).toMatch(/SECURITY DEFINER/i);
    expect(up).toContain('parent academic year not found');
    expect(up).toContain('GRANT EXECUTE');
    expect(up).not.toMatch(/INSERT INTO permissions/i);
    const down = read('apps/api/db/migrations/20260720210000_terms_create.down.sql');
    expect(down).toContain('DROP FUNCTION');
  });

  it('ships IMP-002-P3 update_student helper (UPDATE revoked on table)', () => {
    const up = read('apps/api/db/migrations/20260720220000_students_update.up.sql');
    expect(up).toContain('app.update_student');
    expect(up).toMatch(/SECURITY DEFINER/i);
    expect(up).toContain('GRANT EXECUTE');
    const down = read('apps/api/db/migrations/20260720220000_students_update.down.sql');
    expect(down).toContain('DROP FUNCTION');
  });

  it('ships IMP-003-C0 classes list table SELECT-only for educore_app', () => {
    const up = read('apps/api/db/migrations/20260720230000_classes_list_read.up.sql');
    expect(up).toMatch(/CREATE TABLE classes/i);
    expect(up).toContain('REFERENCES academic_years (id)');
    expect(up).toContain('GRANT SELECT ON TABLE classes TO educore_app');
    expect(up).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE classes FROM educore_app');
    const down = read('apps/api/db/migrations/20260720230000_classes_list_read.down.sql');
    expect(down).toContain('DROP TABLE IF EXISTS classes');
  });
});
