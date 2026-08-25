/**
 * M9-002 staging UAT preflight.
 *
 * This proves only that the staging API health endpoint and web entry point
 * are reachable. It does not log in, call a business endpoint, read data, or
 * replace Owner-run UAT in docs/engineering/qa/M9-uat-core-workflows.md.
 *
 * Usage:
 *   node scripts/ops-stg-m9-uat.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_API_BASE = 'https://educore-api-staging.fly.dev';
const DEFAULT_WEB_BASE = 'https://educore-web-staging.fly.dev';
const TIMEOUT_MS = 10_000;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function stagingUrl(raw, label) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }

  if (
    url.protocol !== 'https:' ||
    (url.hostname !== 'educore-api-staging.fly.dev' &&
      url.hostname !== 'educore-web-staging.fly.dev')
  ) {
    throw new Error(`${label} must use an approved staging Fly HTTPS host`);
  }

  return url;
}

async function probe(name, url) {
  const startedAt = performance.now();
  let status = 'error';
  let detail = 'request failed';

  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json,text/html;q=0.9' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = String(res.status);
    detail = res.ok ? 'reachable' : 'not healthy';
  } catch (error) {
    detail = error instanceof Error && error.name === 'TimeoutError' ? 'timed out' : 'request failed';
  }

  return {
    name,
    host: url.host,
    status,
    detail,
    durationMs: Math.round(performance.now() - startedAt),
    passed: detail === 'reachable',
  };
}

function evidence(rows, checkedAt) {
  const overall = rows.every((row) => row.passed) ? 'Pass' : 'Fail';
  return [
    `# M9 staging preflight — ${checkedAt}`,
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Checked (UTC) | ${checkedAt} |`,
    '| Scope | Health and web reachability only — not workflow UAT |',
    `| Overall | **${overall}** |`,
    '',
    '| Probe | Host | HTTP | Duration | Result |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row.name} | ${row.host} | ${row.status} | ${row.durationMs} ms | ${row.detail} |`),
    '',
    '## Next required action',
    '',
    '- Owner must still complete `docs/engineering/qa/M9-uat-core-workflows.md` and record the critical workflow results separately.',
    '- This record intentionally contains no response body, credential, token, email, tenant ID, or learner data.',
    '',
  ].join('\n');
}

async function main() {
  const api = stagingUrl(process.env['EDUCORE_STAGING_API'] ?? DEFAULT_API_BASE, 'EDUCORE_STAGING_API');
  const web = stagingUrl(process.env['EDUCORE_STAGING_WEB'] ?? DEFAULT_WEB_BASE, 'EDUCORE_STAGING_WEB');
  api.pathname = '/health';
  api.search = '';
  web.pathname = '/';
  web.search = '';

  const checkedAt = new Date().toISOString();
  const rows = await Promise.all([probe('API health', api), probe('Web entry', web)]);
  const content = evidence(rows, checkedAt);
  const recordsDir = path.join(projectRoot, 'docs', 'engineering', 'task-records');
  const stamp = checkedAt.replace(/[:.]/g, '-');
  const output = path.join(recordsDir, `M9-preflight-staging-${stamp}.md`);

  mkdirSync(recordsDir, { recursive: true });
  writeFileSync(output, content, 'utf8');
  process.stdout.write(`wrote ${path.relative(projectRoot, output)}\n`);
  for (const row of rows) {
    process.stdout.write(`${row.name}: ${row.detail} (http=${row.status}, ${row.durationMs}ms)\n`);
  }

  if (!rows.every((row) => row.passed)) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
