import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prettierCli = path.join(projectRoot, 'node_modules', 'prettier', 'bin', 'prettier.cjs');

if (!existsSync(prettierCli)) {
  process.stderr.write('Prettier is not installed. Run npm ci from the repository root.\n');
  process.exit(1);
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function failFromResult(result, context) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    process.stderr.write(`${context}: ${result.error.message}\n`);
    process.exit(1);
  }
}

function runPrettierCheck(targets) {
  const result = run(process.execPath, [prettierCli, '--check', '--ignore-unknown', ...targets]);
  failFromResult(result, 'Prettier check failed to start');
  process.exit(result.status ?? 1);
}

function runFullRepositoryCheck() {
  runPrettierCheck(['.']);
}

if (process.env.CI !== 'true') {
  runFullRepositoryCheck();
}

const baseBranch = process.env.GITHUB_BASE_REF ?? 'main';
const baseRef = `origin/${baseBranch}`;
const hasBaseRef = run('git', ['rev-parse', '--verify', '--quiet', baseRef]);
if (hasBaseRef.status !== 0) {
  process.stderr.write(
    `Git reference ${baseRef} is unavailable in CI checkout; falling back to full repository formatting check.\n`,
  );
  runFullRepositoryCheck();
}

const changedFilesResult = run('git', [
  'diff',
  '--name-only',
  '--diff-filter=ACMR',
  `${baseRef}...HEAD`,
]);
failFromResult(changedFilesResult, 'Unable to compute changed files for Prettier');

const changedFiles = changedFilesResult.stdout
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

if (changedFiles.length === 0) {
  process.stdout.write('No changed files detected for Prettier check.\n');
  process.exit(0);
}

runPrettierCheck(changedFiles);
