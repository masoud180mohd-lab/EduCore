/**
 * ID-003 staging ops — provision Auth0 Regular Web app + write Doppler stg secrets.
 * Never prints secret values.
 *
 * Modes (first match wins):
 *   1. AUTH0_MGMT_TOKEN + AUTH0_DOMAIN — Management API create/update client
 *   2. AUTH0_DOMAIN + AUTH0_MGMT_CLIENT_ID + AUTH0_MGMT_CLIENT_SECRET — client-credentials → API
 *   3. auth0 CLI on PATH (logged in) — `auth0 apps create`
 *
 * Usage:
 *   doppler run --project educore --config stg -- node scripts/ops-stg-provision-auth0.mjs
 *
 * Optional env:
 *   AUTH0_APP_NAME=educore-api-staging
 *   AUTH0_CALLBACK_URLS=https://educore-api-staging.fly.dev/auth/callback,http://localhost:3001/auth/callback
 *   AUTH0_LOGOUT_URLS=https://educore-api-staging.fly.dev/,http://localhost:3001/
 *   AUTH0_WEB_ORIGINS=https://educore-api-staging.fly.dev,http://localhost:3001
 *   AUTH0_SKIP_ENABLE=1  — set domain/client secrets but leave AUTH_IDP_PROVIDER=local
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const PROJECT = 'educore';
const CONFIG = 'stg';
const APP_NAME = (process.env['AUTH0_APP_NAME'] ?? 'educore-api-staging').trim();

function dopplerGet(name) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'get', name, '--plain', '--project', PROJECT, '--config', CONFIG],
    { encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) return undefined;
  const v = (r.stdout || '').trim();
  return v === '' ? undefined : v;
}

function dopplerSet(name, value) {
  const r = spawnSync(
    'doppler',
    ['secrets', 'set', name, '--project', PROJECT, '--config', CONFIG],
    { input: value, encoding: 'utf8', shell: false, windowsHide: true },
  );
  if (r.status !== 0) {
    throw new Error(`doppler set ${name} failed: ${(r.stderr || r.stdout || '').trim()}`);
  }
  process.stdout.write(`doppler set ${name}\n`);
}

function normalizeDomain(raw) {
  let value = (raw ?? '').trim().toLowerCase();
  if (value.startsWith('https://')) value = value.slice('https://'.length);
  if (value.startsWith('http://')) value = value.slice('http://'.length);
  return value.replace(/\/+$/, '');
}

function defaultCallbacks() {
  const callbacks =
    process.env['AUTH0_CALLBACK_URLS']?.trim() ||
    'https://educore-api-staging.fly.dev/auth/callback,http://localhost:3001/auth/callback';
  const logout =
    process.env['AUTH0_LOGOUT_URLS']?.trim() ||
    'https://educore-api-staging.fly.dev/,http://localhost:3001/';
  const origins =
    process.env['AUTH0_WEB_ORIGINS']?.trim() ||
    'https://educore-api-staging.fly.dev,http://localhost:3001';
  return {
    callbacks: callbacks.split(',').map((s) => s.trim()).filter(Boolean),
    logout: logout.split(',').map((s) => s.trim()).filter(Boolean),
    origins: origins.split(',').map((s) => s.trim()).filter(Boolean),
  };
}

async function getMgmtTokenFromClientCredentials(domain, clientId, clientSecret) {
  const res = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${domain}/api/v2/`,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || typeof json.access_token !== 'string') {
    throw new Error(`Auth0 client-credentials failed (${res.status})`);
  }
  return json.access_token;
}

async function mgmt(domain, token, method, path, body) {
  const res = await fetch(`https://${domain}/api/v2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Auth0 Management ${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return json;
}

async function ensureClientViaManagement(domain, token) {
  const urls = defaultCallbacks();
  const list = await mgmt(domain, token, 'GET', '/clients?fields=client_id,name,app_type&include_fields=true&per_page=100');
  const clients = Array.isArray(list) ? list : [];
  const existing = clients.find((c) => c.name === APP_NAME);
  const payload = {
    name: APP_NAME,
    app_type: 'regular_web',
    token_endpoint_auth_method: 'client_secret_post',
    callbacks: urls.callbacks,
    allowed_logout_urls: urls.logout,
    web_origins: urls.origins,
    oidc_conformant: true,
    grant_types: ['authorization_code', 'refresh_token'],
    jwt_configuration: { alg: 'RS256' },
  };

  if (existing?.client_id) {
    process.stdout.write(`Auth0 app exists: ${APP_NAME}\n`);
    const updated = await mgmt(domain, token, 'PATCH', `/clients/${existing.client_id}`, {
      callbacks: urls.callbacks,
      allowed_logout_urls: urls.logout,
      web_origins: urls.origins,
    });
    // PATCH often omits secret — rotate if missing from Doppler
    return {
      clientId: existing.client_id,
      clientSecret: typeof updated.client_secret === 'string' ? updated.client_secret : undefined,
      created: false,
    };
  }

  const created = await mgmt(domain, token, 'POST', '/clients', payload);
  if (typeof created.client_id !== 'string' || typeof created.client_secret !== 'string') {
    throw new Error('Auth0 create client response missing client_id/secret');
  }
  process.stdout.write(`Auth0 app created: ${APP_NAME}\n`);
  return { clientId: created.client_id, clientSecret: created.client_secret, created: true };
}

function ensureClientViaCli(domain) {
  const which = spawnSync('auth0', ['--version'], {
    encoding: 'utf8',
    shell: true,
    windowsHide: true,
  });
  if (which.status !== 0) {
    throw new Error('auth0 CLI not available');
  }

  const urls = defaultCallbacks();
  const list = spawnSync('auth0', ['apps', 'list', '--json'], {
    encoding: 'utf8',
    shell: true,
    windowsHide: true,
  });
  if (list.status !== 0) {
    throw new Error(`auth0 apps list failed — run auth0 login first: ${(list.stderr || list.stdout || '').trim()}`);
  }
  let apps = [];
  try {
    apps = JSON.parse(list.stdout || '[]');
  } catch {
    apps = [];
  }
  const existing = apps.find((a) => a.name === APP_NAME);
  if (existing?.client_id) {
    process.stdout.write(`Auth0 CLI app exists: ${APP_NAME}\n`);
    return {
      clientId: existing.client_id,
      clientSecret: existing.client_secret,
      created: false,
    };
  }

  const args = [
    'apps',
    'create',
    '--name',
    APP_NAME,
    '--type',
    'regular',
    '--callbacks',
    urls.callbacks.join(','),
    '--logout-urls',
    urls.logout.join(','),
    '--origins',
    urls.origins.join(','),
    '--json',
  ];
  const created = spawnSync('auth0', args, {
    encoding: 'utf8',
    shell: true,
    windowsHide: true,
  });
  if (created.status !== 0) {
    throw new Error(`auth0 apps create failed: ${(created.stderr || created.stdout || '').trim()}`);
  }
  const body = JSON.parse(created.stdout || '{}');
  if (typeof body.client_id !== 'string') {
    throw new Error('auth0 apps create missing client_id');
  }
  process.stdout.write(`Auth0 CLI app created: ${APP_NAME}\n`);
  // domain from tenancy
  void domain;
  return {
    clientId: body.client_id,
    clientSecret: typeof body.client_secret === 'string' ? body.client_secret : undefined,
    created: true,
  };
}

async function main() {
  const domain = normalizeDomain(
    process.env['AUTH0_DOMAIN'] ?? dopplerGet('AUTH0_DOMAIN') ?? '',
  );

  let clientId;
  let clientSecret;
  let mode = '';

  const mgmtToken = process.env['AUTH0_MGMT_TOKEN']?.trim();
  const mgmtClientId =
    process.env['AUTH0_MGMT_CLIENT_ID']?.trim() || dopplerGet('AUTH0_MGMT_CLIENT_ID');
  const mgmtClientSecret =
    process.env['AUTH0_MGMT_CLIENT_SECRET']?.trim() || dopplerGet('AUTH0_MGMT_CLIENT_SECRET');

  if (domain && mgmtToken) {
    mode = 'mgmt-token';
    const result = await ensureClientViaManagement(domain, mgmtToken);
    clientId = result.clientId;
    clientSecret = result.clientSecret;
  } else if (domain && mgmtClientId && mgmtClientSecret) {
    mode = 'mgmt-cc';
    const token = await getMgmtTokenFromClientCredentials(domain, mgmtClientId, mgmtClientSecret);
    const result = await ensureClientViaManagement(domain, token);
    clientId = result.clientId;
    clientSecret = result.clientSecret;
  } else {
    mode = 'cli';
    if (!domain) {
      process.stderr.write(
        [
          'Blocked: need AUTH0_DOMAIN (EU tenant hostname, e.g. educore-staging.eu.auth0.com).',
          '',
          'One-time Owner steps:',
          '  1. Create Auth0 tenant (prefer EU) at https://manage.auth0.com/',
          '  2a. Preferred: create M2M app authorized for Management API (create:clients, update:clients, read:clients)',
          '      then: doppler secrets set AUTH0_DOMAIN=... AUTH0_MGMT_CLIENT_ID=... AUTH0_MGMT_CLIENT_SECRET=...',
          '  2b. Or: install auth0 CLI, auth0 login, then set AUTH0_DOMAIN and re-run this script.',
          '',
        ].join('\n'),
      );
      process.exit(2);
    }
    try {
      const result = ensureClientViaCli(domain);
      clientId = result.clientId;
      clientSecret = result.clientSecret;
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(2);
    }
  }

  if (!clientId) throw new Error('No client_id produced');

  // Prefer existing Doppler secret if API did not return a new secret (idempotent re-run)
  const existingSecret = dopplerGet('AUTH0_CLIENT_SECRET');
  if (!clientSecret && existingSecret) {
    clientSecret = existingSecret;
  }
  if (!clientSecret) {
    // Last resort: cannot invent Auth0 secret — fail with clear ops note
    process.stderr.write(
      'Auth0 client_secret not returned (existing app). Rotate in Auth0 dashboard or delete the app and re-run.\n',
    );
    process.exit(2);
  }

  dopplerSet('AUTH0_DOMAIN', domain);
  dopplerSet('AUTH0_CLIENT_ID', clientId);
  dopplerSet('AUTH0_CLIENT_SECRET', clientSecret);

  const skipEnable = process.env['AUTH0_SKIP_ENABLE'] === '1';
  if (!skipEnable) {
    dopplerSet('AUTH_IDP_PROVIDER', 'auth0');
  } else {
    process.stdout.write('AUTH_IDP_PROVIDER left unchanged (AUTH0_SKIP_ENABLE=1)\n');
  }

  // Correlation id for ops logs only
  process.stdout.write(
    `Auth0 staging provision ok mode=${mode} app=${APP_NAME} domain=${domain} corr=${randomBytes(4).toString('hex')}\n`,
  );
  process.stdout.write('NEXT: npm run db:migrate (doppler run) if ID-003 migration pending\n');
  process.stdout.write('NEXT: node scripts/ops-stg-sync-fly-secrets.mjs\n');
  process.stdout.write(
    'NEXT: create Auth0 user matching admin@educore.staging (or first-link on verified email login)\n',
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
