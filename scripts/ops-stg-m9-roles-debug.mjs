/** One-off diagnostic: list roles present for the staging tenant. */
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
await client.connect();
const cols = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'roles' ORDER BY ordinal_position`,
);
process.stdout.write(`roles columns: ${cols.rows.map((r) => r.column_name).join(', ')}\n`);
const roles = await client.query(`SELECT id, code FROM roles ORDER BY code LIMIT 30`);
for (const r of roles.rows) process.stdout.write(`role: ${r.code} (${r.id})\n`);
await client.end();
