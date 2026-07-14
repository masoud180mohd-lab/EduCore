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
});
