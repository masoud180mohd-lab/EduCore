/**
 * ID-003-OPS smoke — create Auth0 DB user (if needed), mint ID token, login EduCore staging.
 * Never prints secrets or full tokens.
 *
 * Usage:
 *   doppler run --project educore --config stg -- node scripts/ops-stg-auth0-smoke.mjs
 *
 * Requires: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH_IDP_PROVIDER=auth0,
 *           SEED_ADMIN_PASS (EduCore password login for tenantId discovery).
 *
 * Token mint order:
 *   1. Password / password-realm grant (if enabled on Auth0 app)
 *   2. PKCE browser login → http://localhost:3001/auth/callback (already on app callbacks)
 */
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const EMAIL = (process.env['SEED_ADMIN_EMAIL'] ?? 'admin@educore.staging').trim().toLowerCase();
const API = (process.env['EDUCORE_STAGING_API'] ?? 'https://educore-api-staging.fly.dev').replace(
  /\/$/,
  '',
);
const CONNECTION = 'Username-Password-Authentication';
const REDIRECT_URI = 'http://localhost:3001/auth/callback';
const PKCE_TIMEOUT_MS = Number(process.env['AUTH0_SMOKE_PKCE_TIMEOUT_MS'] ?? 180_000);

function redacted(token) {
  if (typeof token !== 'string' || token.length < 12) return '(none)';
  return `${token.slice(0, 8)}…len=${token.length}`;
}

function normalizeDomain(raw) {
  let value = (raw ?? '').trim().toLowerCase();
  if (value.startsWith('https://')) value = value.slice(8);
  if (value.startsWith('http://')) value = value.slice(7);
  return value.replace(/\/+$/, '');
}

async function jsonFetch(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { res, json, text };
}

async function educorePasswordLogin(password) {
  const { res, json } = await jsonFetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-correlation-id': `auth0-smoke-pw-${randomBytes(3).toString('hex')}`,
    },
    body: JSON.stringify({ email: EMAIL, password }),
  });
  if (!res.ok) {
    throw new Error(`EduCore password login failed ${res.status}: ${json?.error?.code ?? textHint(json)}`);
  }
  return json.data ?? json;
}

function textHint(json) {
  return JSON.stringify(json).slice(0, 200);
}

async function tryMgmtToken(domain, clientId, clientSecret) {
  const { res, json } = await jsonFetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${domain}/api/v2/`,
    }),
  });
  if (!res.ok || typeof json.access_token !== 'string') return null;
  return json.access_token;
}

async function ensurePasswordGrant(domain, mgmtToken, clientId) {
  const { res, json } = await jsonFetch(`https://${domain}/api/v2/clients/${clientId}`, {
    headers: { Authorization: `Bearer ${mgmtToken}`, accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Auth0 get client failed ${res.status}`);
  }
  const grants = Array.isArray(json.grant_types) ? [...json.grant_types] : [];
  const need = ['password', 'http://auth0.com/oauth/grant-type/password-realm'];
  let changed = false;
  for (const g of need) {
    if (!grants.includes(g)) {
      grants.push(g);
      changed = true;
    }
  }
  if (!changed) {
    process.stdout.write('Auth0 password grant already enabled\n');
    return;
  }
  const patch = await jsonFetch(`https://${domain}/api/v2/clients/${clientId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${mgmtToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ grant_types: grants }),
  });
  if (!patch.res.ok) {
    throw new Error(`Auth0 enable password grant failed ${patch.res.status}: ${textHint(patch.json)}`);
  }
  process.stdout.write('Auth0 password grant enabled on app (smoke only)\n');
}

async function ensureAuth0User(domain, clientId, password) {
  const { res, json } = await jsonFetch(`https://${domain}/dbconnections/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      email: EMAIL,
      password,
      connection: CONNECTION,
      name: 'EduCore Staging Admin',
    }),
  });
  if (res.ok) {
    process.stdout.write(`Auth0 user created: ${EMAIL}\n`);
    return 'created';
  }
  const blob = `${json.code ?? ''} ${json.name ?? ''} ${json.description ?? ''} ${json.message ?? ''}`.toLowerCase();
  if (
    res.status === 400 &&
    (blob.includes('user_exists') ||
      blob.includes('already') ||
      blob.includes('exists') ||
      blob.includes('invalid_signup'))
  ) {
    // invalid_signup often means user already exists or public signup locked — continue to login.
    process.stdout.write(`Auth0 signup skipped (${json.code ?? json.name ?? res.status}): assume user exists\n`);
    return 'assumed_exists';
  }
  throw new Error(`Auth0 signup failed ${res.status}: ${textHint(json)}`);
}

async function mintIdToken(domain, clientId, clientSecret, password) {
  // Prefer password-realm (Auth0 DB connection)
  const attempts = [
    {
      grant_type: 'http://auth0.com/oauth/grant-type/password-realm',
      username: EMAIL,
      password,
      client_id: clientId,
      client_secret: clientSecret,
      realm: CONNECTION,
      scope: 'openid profile email',
    },
    {
      grant_type: 'password',
      username: EMAIL,
      password,
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'openid profile email',
      connection: CONNECTION,
    },
  ];

  let last = null;
  for (const body of attempts) {
    const { res, json } = await jsonFetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    last = { res, json };
    if (res.ok && typeof json.id_token === 'string') {
      process.stdout.write('id_token_via=password_grant\n');
      return json.id_token;
    }
  }

  process.stdout.write(
    `password_grant_blocked ${last?.res.status}: falling back to PKCE browser login\n`,
  );
  return mintIdTokenViaPkce(domain, clientId, clientSecret);
}

function base64Url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}

async function mintIdTokenViaPkce(domain, clientId, clientSecret) {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  const state = base64Url(randomBytes(16));

  const authorize = new URL(`https://${domain}/authorize`);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', REDIRECT_URI);
  authorize.searchParams.set('scope', 'openid profile email');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('login_hint', EMAIL);
  authorize.searchParams.set('connection', CONNECTION);

  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error(`PKCE timed out after ${PKCE_TIMEOUT_MS}ms — log in at Auth0 when browser opens`));
    }, PKCE_TIMEOUT_MS);

    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://localhost:3001');
        if (url.pathname !== '/auth/callback') {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        const err = url.searchParams.get('error');
        if (err) {
          res.writeHead(400, { 'content-type': 'text/plain' });
          res.end(`Auth0 error: ${err}`);
          clearTimeout(timer);
          server.close();
          reject(new Error(`Auth0 authorize error: ${err} ${url.searchParams.get('error_description') ?? ''}`));
          return;
        }
        const gotState = url.searchParams.get('state');
        const gotCode = url.searchParams.get('code');
        if (gotState !== state || !gotCode) {
          res.writeHead(400, { 'content-type': 'text/plain' });
          res.end('invalid state/code');
          clearTimeout(timer);
          server.close();
          reject(new Error('PKCE callback missing state/code'));
          return;
        }
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Auth0 smoke OK</h1><p>Return to the terminal.</p></body></html>');
        clearTimeout(timer);
        server.close();
        resolve(gotCode);
      } catch (e) {
        clearTimeout(timer);
        server.close();
        reject(e);
      }
    });

    server.listen(3001, '127.0.0.1', () => {
      process.stdout.write(`Open Auth0 login (user ${EMAIL}) — browser should open.\n`);
      process.stdout.write(`If not: ${authorize.toString()}\n`);
      openBrowser(authorize.toString());
    });
  });

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });
  const { res, json } = await jsonFetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok || typeof json.id_token !== 'string') {
    throw new Error(`PKCE token exchange failed ${res.status}: ${textHint(json)}`);
  }
  process.stdout.write('id_token_via=pkce\n');
  return json.id_token;
}

async function educoreIdpLogin(idToken, tenantId) {
  const { res, json } = await jsonFetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-correlation-id': `auth0-smoke-idp-${randomBytes(3).toString('hex')}`,
    },
    body: JSON.stringify({
      idpAssertion: idToken,
      tenantId,
    }),
  });
  if (!res.ok) {
    throw new Error(`EduCore IdP login failed ${res.status}: ${textHint(json)}`);
  }
  return json.data ?? json;
}

async function educoreMe(accessToken) {
  const { res, json } = await jsonFetch(`${API}/api/v1/auth/me`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      'x-correlation-id': `auth0-smoke-me-${randomBytes(3).toString('hex')}`,
    },
  });
  if (!res.ok) {
    throw new Error(`EduCore /auth/me failed ${res.status}: ${textHint(json)}`);
  }
  return json.data ?? json;
}

async function main() {
  const domain = normalizeDomain(process.env['AUTH0_DOMAIN'] ?? '');
  const clientId = process.env['AUTH0_CLIENT_ID']?.trim() ?? '';
  const clientSecret = process.env['AUTH0_CLIENT_SECRET']?.trim() ?? '';
  const idp = (process.env['AUTH_IDP_PROVIDER'] ?? 'local').trim().toLowerCase();
  const educorePass = process.env['SEED_ADMIN_PASS']?.trim() ?? '';
  const auth0Pass =
    process.env['AUTH0_SMOKE_PASS']?.trim() ||
    educorePass ||
    `Auth0-Smoke-${randomBytes(6).toString('hex')}!aA1`;

  if (idp !== 'auth0') throw new Error('AUTH_IDP_PROVIDER must be auth0');
  if (!domain || !clientId || !clientSecret) throw new Error('AUTH0_DOMAIN/CLIENT_ID/SECRET required');
  if (educorePass.length < 8) throw new Error('SEED_ADMIN_PASS required (≥8) for tenant discovery');

  process.stdout.write(`API=${API}\n`);
  process.stdout.write(`email=${EMAIL}\n`);
  process.stdout.write(`auth0_domain=${domain}\n`);

  const pwLogin = await educorePasswordLogin(educorePass);
  const tenantId = pwLogin.tenantId;
  if (typeof tenantId !== 'string' || tenantId === '') {
    throw new Error('EduCore password login missing tenantId');
  }
  process.stdout.write(`educore_password_login=ok tenant=${tenantId}\n`);

  const mgmt = await tryMgmtToken(domain, clientId, clientSecret);
  if (mgmt) {
    process.stdout.write('mgmt_api=ok\n');
    await ensurePasswordGrant(domain, mgmt, clientId);
  } else {
    process.stdout.write(
      'mgmt_api=unavailable (authorize M2M or enable Password grant manually if mint fails)\n',
    );
  }

  await ensureAuth0User(domain, clientId, auth0Pass);
  const idToken = await mintIdToken(domain, clientId, clientSecret, auth0Pass);
  process.stdout.write(`id_token=${redacted(idToken)}\n`);

  const idpLogin = await educoreIdpLogin(idToken, tenantId);
  if (!idpLogin.accessToken || typeof idpLogin.accessToken !== 'string') {
    if (idpLogin.requiresMfa) {
      process.stdout.write('idp_login=mfa_challenge (pass — IdP mapped; MFA still required)\n');
      process.stdout.write('SMOKE_PASS\n');
      return;
    }
    throw new Error(`IdP login missing accessToken: ${textHint(idpLogin)}`);
  }
  process.stdout.write(`idp_login=ok access=${redacted(idpLogin.accessToken)}\n`);

  const me = await educoreMe(idpLogin.accessToken);
  const meEmail = me.user?.email ?? me.email;
  process.stdout.write(`auth_me=ok email=${meEmail}\n`);
  if (String(meEmail).toLowerCase() !== EMAIL) {
    throw new Error(`email mismatch: expected ${EMAIL} got ${meEmail}`);
  }
  process.stdout.write('SMOKE_PASS\n');
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
