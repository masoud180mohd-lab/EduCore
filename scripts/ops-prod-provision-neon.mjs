/**
 * Create Neon project `educore-prod` in Frankfurt and point Doppler `educore`/`prd`.
 * Does not print connection URIs. Does not stamp Board GO.
 *
 * Usage:
 *   CONFIRM=YES doppler run --project educore --config prd -- node scripts/ops-prod-provision-neon.mjs
 */
import { spawnSync } from 'node:child_process';

const API = 'https://console.neon.tech/api/v2';
const REGION = 'aws-eu-central-1';
const NAME = 'educore-prod';
const CONFIG = 'prd';

function setSecret(name, value) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'set', name, '--silent', '--project', 'educore', '--config', CONFIG],
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
    ['secrets', 'get', name, '--plain', '--project', 'educore', '--config', CONFIG],
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
    throw new Error(`Neon API ${method} ${urlPath} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return json;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

async function bindDatabaseUrl(apiKey, projectId) {
  const conn = await neon(
    apiKey,
    'GET',
    `/projects/${projectId}/connection_uri?database_name=neondb&role_name=neondb_owner`,
  );
  const uri = conn.uri ?? conn.connection_uri;
  if (!uri) {
    throw new Error('Neon connection_uri missing for educore-prod');
  }
  const current = getSecret('DATABASE_URL');
  const wantHost = hostOf(uri);
  const haveHost = current ? hostOf(current) : '';
  if (haveHost && haveHost === wantHost) {
    process.stdout.write(`prd DATABASE_URL already on ${wantHost}\n`);
    return;
  }
  if (current && haveHost !== wantHost) {
    setSecret('DATABASE_URL_BEFORE_PROD_PROVISION', current);
    process.stdout.write(`rewriting prd DATABASE_URL host ${haveHost} → ${wantHost}\n`);
  } else {
    process.stdout.write(`setting prd DATABASE_URL host ${wantHost}\n`);
  }
  setSecret('DATABASE_URL', uri);
}

async function main() {
  if (process.env['CONFIRM'] !== 'YES') {
    throw new Error('Refusing: set CONFIRM=YES to create/bind production Neon');
  }

  const apiKey = process.env['NEON_API_KEY']?.trim() ?? getSecret('NEON_API_KEY');
  if (!apiKey) throw new Error('NEON_API_KEY required');

  const projects = await neon(apiKey, 'GET', '/projects');
  const existing = (projects.projects ?? []).find(
    (p) => p.name === NAME || (p.region_id === REGION && /educore-prod/i.test(p.name ?? '')),
  );

  if (existing) {
    process.stdout.write(
      `project already exists: ${existing.name} (${existing.id}) region=${existing.region_id}\n`,
    );
    setSecret('NEON_PROJECT_ID', existing.id);
    await bindDatabaseUrl(apiKey, existing.id);
    return;
  }

  const existingUrl = getSecret('DATABASE_URL');
  if (existingUrl) {
    setSecret('DATABASE_URL_BEFORE_PROD_PROVISION', existingUrl);
    process.stdout.write('preserved previous prd DATABASE_URL as DATABASE_URL_BEFORE_PROD_PROVISION\n');
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
  process.stdout.write('prd DATABASE_URL now points at Frankfurt Neon educore-prod.\n');
  process.stdout.write('NEXT: doppler run --project educore --config prd -- npm run db:bootstrap-roles\n');
  process.stdout.write('THEN: doppler run --project educore --config prd -- npm run db:migrate\n');
  process.stdout.write('THEN: node scripts/ops-prod-set-runtime-secrets.mjs (via doppler prd)\n');
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
