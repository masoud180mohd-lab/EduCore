/**
 * Dev server for Nest API with decorator metadata.
 *
 * `tsx` does not emit design:paramtypes metadata required by Nest DI.
 * This script: load root .env → tsc once → tsc --watch + node --watch dist/main.js
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(rootDir, 'apps', 'api');
const tsconfig = path.join(apiDir, 'tsconfig.json');
const entry = path.join(apiDir, 'dist', 'main.js');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }
  const text = readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Do not override env already set by the shell/CI.
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function run(command, args, options = {}) {
  return spawn(command, args, {
    cwd: apiDir,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
    ...options,
  });
}

function runSyncExit(command, args) {
  return new Promise((resolve, reject) => {
    const child = run(command, args);
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited via signal ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

loadEnvFile(path.join(rootDir, '.env'));
loadEnvFile(path.join(rootDir, '.env.local'));

// Local defaults so `npm run start:dev` works after seed without manual exports.
if (process.env['EDUCORE_ENABLE_APP_DB'] === undefined) {
  process.env['EDUCORE_ENABLE_APP_DB'] = '1';
}
if (process.env['NODE_ENV'] === undefined) {
  process.env['NODE_ENV'] = 'development';
}

console.log('[api-start-dev] Compiling Nest API with tsc (decorator metadata)...');
const buildCode = await runSyncExit('npx', ['tsc', '-p', tsconfig]);
if (buildCode !== 0) {
  console.error('[api-start-dev] Initial tsc failed.');
  process.exit(buildCode);
}
if (!existsSync(entry)) {
  console.error(`[api-start-dev] Missing ${entry} after compile.`);
  process.exit(1);
}

console.log('[api-start-dev] Starting tsc --watch + node --watch dist/main.js');
const tscWatch = run('npx', ['tsc', '-p', tsconfig, '--watch', '--preserveWatchOutput']);
const nodeWatch = run('node', ['--watch', 'dist/main.js']);

const children = [tscWatch, nodeWatch];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

tscWatch.on('exit', (code) => {
  if (!shuttingDown) {
    console.error(`[api-start-dev] tsc --watch exited (${String(code)})`);
    shutdown(code ?? 1);
  }
});
nodeWatch.on('exit', (code) => {
  if (!shuttingDown) {
    console.error(`[api-start-dev] node --watch exited (${String(code)})`);
    shutdown(code ?? 1);
  }
});
