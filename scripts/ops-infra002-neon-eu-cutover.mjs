/**
 * INFRA-002-CUTOVER — create Neon project in aws-eu-central-1 (Frankfurt),
 * point Doppler stg at it, bootstrap + migrate. Does not print secrets.
 *
 * Usage:
 *   doppler run --project educore --config stg -- node scripts/ops-infra002-neon-eu-cutover.mjs
 *
 * After success: npm run db:bootstrap-roles && db:migrate (via doppler),
 * rotate passwords, seed, sync Fly (script prints next commands).
 */
import { spawnSync } from 'node:child_process';

const API = 'https://console.neon.tech/api/v2';
const REGION = 'aws-eu-central-1';
const NAME = 'educore-staging-fra';

function setSecret(name, value) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'set', name, '--project', 'educore', '--config', 'stg'],
    { input: value, encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) {
    throw new Error(`doppler set ${name} failed: ${(r.stderr || r.stdout || '').trim()}`);
  }
  process.stdout.write(`set ${name}\n`);
}

function getSecret(name) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'get', name, '--plain', '--project', 'educore', '--config', 'stg'],
    { encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) return undefined;
  const v = (r.stdout || '').trim();
  return v === '' ? undefined : v;
}

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

async function main() {
  const apiKey = process.env['NEON_API_KEY']?.trim();
  if (!apiKey) throw new Error('NEON_API_KEY required');

  const oldUrl = getSecret('DATABASE_URL');
  if (oldUrl) {
    setSecret('DATABASE_URL_LEGACY_USEAST2', oldUrl);
    process.stdout.write('preserved previous DATABASE_URL as DATABASE_URL_LEGACY_USEAST2\n');
  }

  const projects = await neon(apiKey, 'GET', '/projects');
  const existing = (projects.projects ?? []).find(
    (p) =>
      p.name === NAME ||
      (p.region_id === REGION && /educore.*fra|educore-staging-fra/i.test(p.name)),
  );
  if (existing) {
    process.stdout.write(
      `project already exists: ${existing.name} (${existing.id}) region=${existing.region_id}\n`,
    );
    process.stdout.write(
      'Set DATABASE_URL manually from Neon console if needed, then continue bootstrap.\n',
    );
    setSecret('NEON_PROJECT_ID', existing.id);
    return;
  }

  process.stdout.write(`creating Neon project ${NAME} in ${REGION}…\n`);
  const created = await neon(apiKey, 'POST', '/projects', {
    project: {
      name: NAME,
      region_id: REGION,
      pg_version: 16,
    },
  });

  const project = created.project;
  const uri = created.connection_uris?.[0]?.connection_uri;
  if (!project?.id || !uri) {
    throw new Error('create project response missing project id or connection_uri');
  }

  process.stdout.write(`created ${project.name} (${project.id}) region=${project.region_id}\n`);
  setSecret('NEON_PROJECT_ID', project.id);
  setSecret('DATABASE_URL', uri);
  process.stdout.write('DATABASE_URL now points at Frankfurt Neon.\n');
  process.stdout.write(
    'NEXT: doppler run --project educore --config stg -- npm run db:bootstrap-roles\n',
  );
  process.stdout.write('THEN: doppler run --project educore --config stg -- npm run db:migrate\n');
  process.stdout.write(
    'THEN: doppler run --project educore --config stg -- node scripts/ops-stg-rotate-db-passwords.mjs\n',
  );
  process.stdout.write(
    'THEN: seed + fly sync (ops-stg-prepare-admin-seed / seed:admin / ops-stg-sync-fly-secrets)\n',
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
