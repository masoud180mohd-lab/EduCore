/**
 * Debug staging MFA begin path (no secrets printed beyond error codes).
 * Usage: doppler run --project educore --config stg -- node scripts/ops-stg-mfa-begin-debug.mjs
 */
import { randomUUID } from 'node:crypto';

import pg from 'pg';

async function main() {
  const url = process.env['EDUCORE_APP_DATABASE_URL']?.trim();
  if (!url) throw new Error('EDUCORE_APP_DATABASE_URL required');

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const who = await client.query('select current_user as u, current_database() as d');
    process.stdout.write(`db_user=${who.rows[0].u} db=${who.rows[0].d}\n`);

    const users = await client.query(
      `select id::text as id, email from users where lower(email) = $1 limit 1`,
      ['admin@educore.staging'],
    );
    if (users.rows[0] === undefined) {
      process.stdout.write('admin@educore.staging not visible to educore_app (expected under RLS)\n');
    } else {
      process.stdout.write(`visible_user=${users.rows[0].email}\n`);
    }

    // Prefer SECURITY DEFINER lookup via migrator/owner URL if available for user id
    const ownerUrl = process.env['DATABASE_URL']?.trim();
    let userId = users.rows[0]?.id;
    if (!userId && ownerUrl) {
      const owner = new pg.Client({ connectionString: ownerUrl });
      await owner.connect();
      const r = await owner.query(
        `select id::text as id from users where lower(email) = $1 limit 1`,
        ['admin@educore.staging'],
      );
      userId = r.rows[0]?.id;
      await owner.end();
      process.stdout.write(`owner_lookup_user=${userId ? 'found' : 'missing'}\n`);
    }
    if (!userId) throw new Error('could not resolve admin user id');

    const factorId = randomUUID();
    const idem = `debug-${Date.now()}`;
    try {
      const r = await client.query(
        `SELECT * FROM app.mfa_begin_totp_enrollment($1::uuid, $2::uuid, $3::text, $4::text, $5::text)`,
        [userId, factorId, 'v1.testiv.testtag.testcipher', 'Authenticator', idem],
      );
      process.stdout.write(`begin_ok id=${r.rows[0]?.id} status=${r.rows[0]?.status}\n`);
      // cleanup pending
      await client.query(`SELECT * FROM app.mfa_disable_factor($1::uuid, $2::uuid)`, [
        userId,
        factorId,
      ]);
      process.stdout.write('cleanup_ok\n');
    } catch (err) {
      const e = err;
      process.stdout.write(
        `begin_ERR code=${e?.code ?? '?'} message=${String(e?.message ?? err).slice(0, 300)}\n`,
      );
    }

    // Check RLS policies
    const pols = await client.query(
      `select polname, polcmd from pg_policy where polrelid = 'mfa_factors'::regclass order by 1`,
    );
    process.stdout.write(
      `policies=${pols.rows.map((p) => `${p.polname}:${p.polcmd}`).join(',') || '(none)'}\n`,
    );
    const force = await client.query(
      `select relforcerowsecurity, relrowsecurity from pg_class where oid = 'mfa_factors'::regclass`,
    );
    process.stdout.write(
      `rls=${force.rows[0]?.relrowsecurity} force=${force.rows[0]?.relforcerowsecurity}\n`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
