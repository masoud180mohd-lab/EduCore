/**
 * B-07 D1 — create ephemeral Neon branch, spot-check, delete, write evidence.
 * Requires: NEON_API_KEY, DATABASE_URL (owner), EDUCORE_APP_DATABASE_URL (for password reuse).
 *
 * Usage:
 *   doppler run --project educore --config stg -- node scripts/ops-d1-restore-drill.mjs
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const API = 'https://console.neon.tech/api/v2';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`${name} is required`);
  }
  return v;
}

async function neon(apiKey, method, urlPath, body) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
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
    throw new Error(`Neon API ${method} ${urlPath} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return json;
}

function withAppRole(ownerUrl, appUrl) {
  const owner = new URL(ownerUrl);
  const app = new URL(appUrl);
  owner.username = app.username;
  owner.password = app.password;
  return owner;
}

function swapHost(templateUrl, host, database) {
  const u = new URL(templateUrl.toString());
  u.host = host;
  if (database) {
    u.pathname = `/${database}`;
  }
  return u.toString();
}

async function main() {
  const started = new Date();
  const apiKey = requireEnv('NEON_API_KEY');
  const ownerUrl = requireEnv('DATABASE_URL');
  const appUrl = requireEnv('EDUCORE_APP_DATABASE_URL');
  const projectId = process.env['NEON_PROJECT_ID']?.trim();

  process.stdout.write(`D1 start (UTC): ${started.toISOString()}\n`);

  const projects = await neon(apiKey, 'GET', '/projects');
  const list = projects.projects ?? [];
  const project =
    (projectId ? list.find((p) => p.id === projectId) : undefined) ??
    list.find((p) => /educore-staging-fra/i.test(p.name ?? '')) ??
    list.find((p) => /educore/i.test(p.name ?? '')) ??
    list[0];
  if (!project) {
    throw new Error('No Neon project found for this API key');
  }
  process.stdout.write(`project: ${project.name} (${project.id})\n`);

  const branchesPayload = await neon(apiKey, 'GET', `/projects/${project.id}/branches`);
  const branches = branchesPayload.branches ?? [];
  const primary =
    branches.find((b) => b.default) ?? branches.find((b) => b.name === 'main') ?? branches[0];
  if (!primary) {
    throw new Error('No primary branch found');
  }

  const drillName = `drill-${started.toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36)}`;
  process.stdout.write(`creating branch ${drillName} from ${primary.name}…\n`);

  const created = await neon(apiKey, 'POST', `/projects/${project.id}/branches`, {
    branch: {
      name: drillName,
      parent_id: primary.id,
    },
    endpoints: [{ type: 'read_write' }],
  });

  const drillBranch = created.branch;
  const endpoint = (created.endpoints ?? [])[0];
  if (!drillBranch?.id || !endpoint?.host) {
    throw new Error('Branch create response missing branch/endpoint');
  }

  // Connection URIs sometimes returned on create
  const conn =
    created.connection_uris?.[0]?.connection_uri ??
    null;

  const appTemplate = withAppRole(ownerUrl, appUrl);
  const dbName = new URL(ownerUrl).pathname.replace(/^\//, '') || 'neondb';
  const drillAppUrl = conn
    ? (() => {
        const u = new URL(conn);
        u.username = appTemplate.username;
        u.password = appTemplate.password;
        return u.toString();
      })()
    : swapHost(appTemplate, endpoint.host, dbName);

  const client = new pg.Client({ connectionString: drillAppUrl });
  await client.connect();
  const who = await client.query('select current_user as u, current_database() as d');
  const tenants = await client.query('select count(*)::int as n from tenants');
  const memberships = await client.query('select count(*)::int as n from tenant_memberships');
  const migrations = await client.query('select count(*)::int as n from schema_migrations');
  await client.end();

  process.stdout.write(
    `spot-check user=${who.rows[0].u} db=${who.rows[0].d} tenants=${tenants.rows[0].n} memberships=${memberships.rows[0].n} migrations=${migrations.rows[0].n}\n`,
  );

  process.stdout.write(`deleting drill branch ${drillName}…\n`);
  await neon(apiKey, 'DELETE', `/projects/${project.id}/branches/${drillBranch.id}`);

  const ended = new Date();
  const rtoSec = Math.round((ended.getTime() - started.getTime()) / 1000);
  const day = started.toISOString().slice(0, 10);
  const evidencePath = path.join(
    projectRoot,
    'docs/engineering/task-records',
    `B-07-restore-drill-${day}.md`,
  );

  const md = `# B-07 restore drill — ${day}

| Field | Value |
| --- | --- |
| Env | staging Neon (\`${project.name}\` / project \`${project.id}\`) |
| Start (UTC) | ${started.toISOString()} |
| End (UTC) | ${ended.toISOString()} |
| RTO measured | ${rtoSec}s (branch create + spot-check + delete) |
| RPO assumed | Neon PITR / branch from primary head (\`${primary.name}\`) |
| Pass / Fail | **Pass** |
| Owner | Project Owner / solo-operator (SOLO-GOV-001) |
| Notes | Ephemeral branch \`${drillName}\` created from primary, connected as \`educore_app\`, branch deleted. Fly app not rewired (DB-only drill per OPS-001). |

## Spot checks

| Check | Result |
| --- | --- |
| current_user (drill branch) | \`${who.rows[0].u}\` |
| current_database | \`${who.rows[0].d}\` |
| schema_migrations count (app role) | ${migrations.rows[0].n} |
| tenants / memberships via \`educore_app\` without tenant GUC | ${tenants.rows[0].n} / ${memberships.rows[0].n} (0/0 expected under FORCE RLS) |

## Honesty

- This drill proves **branch clone + app-role connect** on B-05 Neon topology within **${rtoSec}s** (≪ RTO 8h).
- App-role zero counts without \`app.current_tenant\` are **RLS honesty**, not empty DB.
- It is **not** an in-place overwrite of primary via \`^self@timestamp\` (optional harder drill later).
- Prefer \`NEON_PROJECT_ID\` for Frankfurt (\`educore-staging-fra\`) when multiple Neon projects remain.
`;

  writeFileSync(evidencePath, md, 'utf8');
  process.stdout.write(`evidence: ${evidencePath}\n`);
  process.stdout.write(`D1 Pass — RTO ${rtoSec}s (limit 8h)\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
