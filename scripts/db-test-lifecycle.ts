/**
 * IMP-001-T04 foundation: documents and orchestrates test DB lifecycle.
 * Does not create business schema. Live migrate requires DATABASE_URL + Docker.
 *
 * Usage:
 *   npm run db:test-lifecycle -- --print
 *   npm run db:test-lifecycle -- --migrate   # requires Postgres
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const help = `
EduCore test database lifecycle (P0 foundation)

Recommended local setup:
  1. npm run docker:up
  2. export DATABASE_URL=postgresql://educore:educore_local_only@127.0.0.1:5432/educore
     (or rely on DEV-001 defaults in migrate scripts)
  3. npm run db:migrate
  4. npm run db:bootstrap-roles
  5. For isolation tests (P1+): use a dedicated database educore_test
     created from the same migrations (never share mutable state with manual poking).

Parallel-safe strategy:
  - Prefer one migrate per test process against educore_test
  - Wrap cases in transactions + ROLLBACK where possible (P1)
  - Never log DATABASE_URL or role passwords

Flags:
  --print     Print this guidance (default)
  --migrate   Run npm run db:migrate (exit 2 if DB unavailable)
  --help      Show help
`.trim();

function main(): void {
  const args = new Set(process.argv.slice(2));

  if (args.has('--help') || args.size === 0 || args.has('--print')) {
    process.stdout.write(`${help}\n`);
  }

  if (args.has('--migrate')) {
    const result = spawnSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['run', 'db:migrate'],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        env: process.env,
        shell: process.platform === 'win32',
      },
    );

    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    process.exitCode = result.status === null ? 1 : result.status;
  }
}

main();
