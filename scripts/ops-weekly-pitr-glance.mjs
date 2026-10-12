/**
 * B-07 SLO-5 — weekly Neon PITR / backup glance (names + retention only).
 * Does not print connection URLs or secrets.
 *
 * Usage:
 *   doppler run --project educore --config stg -- node scripts/ops-weekly-pitr-glance.mjs
 *   EXTEND_DAYS=7 doppler run --project educore --config stg -- node scripts/ops-weekly-pitr-glance.mjs
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://console.neon.tech/api/v2';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function neon(apiKey, method, urlPath, body) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Neon API ${method} ${urlPath} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return json;
}

function fmtRetention(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return String(seconds);
  if (s % 86400 === 0) return `${s / 86400}d (${s}s)`;
  if (s % 3600 === 0) return `${s / 3600}h (${s}s)`;
  return `${s}s`;
}

async function main() {
  const apiKey = process.env['NEON_API_KEY']?.trim();
  if (!apiKey) throw new Error('NEON_API_KEY required');

  const checkedAt = new Date().toISOString();
  const preferId = process.env['NEON_PROJECT_ID']?.trim();
  const extendDays = Number(process.env['EXTEND_DAYS'] ?? '0');

  const payload = await neon(apiKey, 'GET', '/projects');
  const list = payload.projects ?? [];
  if (list.length === 0) throw new Error('no Neon projects');

  const rows = [];
  for (const p of list) {
    const before = p.history_retention_seconds;
    let after = before;
    let extendNote = 'unchanged';
    const isTarget =
      (preferId && p.id === preferId) || /educore-staging-fra|educore-prod/i.test(p.name ?? '');

    if (extendDays > 0 && isTarget) {
      const want = extendDays * 86400;
      try {
        const updated = await neon(apiKey, 'PATCH', `/projects/${p.id}`, {
          project: { history_retention_seconds: want },
        });
        after = updated.project?.history_retention_seconds ?? want;
        extendNote = `PATCH ${fmtRetention(before)} → ${fmtRetention(after)}`;
      } catch (err) {
        extendNote = `PATCH failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    rows.push({
      name: p.name,
      id: p.id,
      region: p.region_id,
      pg: p.pg_version,
      retention: fmtRetention(after),
      extendNote,
    });
  }

  const lines = [
    `# B-07 weekly PITR glance — ${checkedAt.slice(0, 10)}`,
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Checked (UTC) | ${checkedAt} |`,
    '| Owner | Project Owner / solo-operator (SOLO-GOV-001) |',
    '| Signal | Neon `history_retention_seconds` + project list (SLO-5) |',
    '',
    '## Projects',
    '',
    '| Name | Region | PG | Retention | Extend |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.name} | ${r.region} | ${r.pg} | ${r.retention} | ${r.extendNote} |`),
    '',
    '## Honesty',
    '',
    '- RPO ≤ 24h (B-05) is **data-loss window**, not how far back PITR can reach.',
    '- Short `history_retention_seconds` (e.g. 6h on free/launch) means restore older than that window is **not** possible.',
    '- This glance is **not** a restore drill (see D1/D2 evidence files).',
    '- Project ids are operational identifiers, not secrets; connection URIs are omitted.',
    '',
  ];

  const out = path.join(
    projectRoot,
    'docs',
    'engineering',
    'task-records',
    `B-07-pitr-glance-${checkedAt.slice(0, 10)}.md`,
  );
  writeFileSync(out, lines.join('\n'), 'utf8');
  process.stdout.write(`wrote ${path.relative(projectRoot, out)}\n`);
  for (const r of rows) {
    process.stdout.write(
      `${r.name} region=${r.region} pg=${r.pg} retention=${r.retention} ${r.extendNote}\n`,
    );
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
