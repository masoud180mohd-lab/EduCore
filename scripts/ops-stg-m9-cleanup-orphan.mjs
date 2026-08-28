/** One-off cleanup: remove the orphan UAT parent user created by a failed fixture run. */
import pg from 'pg';

const ORPHAN_ID = 'e8bd923c-53bb-4a62-b853-04dadb33d5e8';

const client = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
await client.connect();
await client.query('DELETE FROM tenant_memberships WHERE user_id = $1', [ORPHAN_ID]);
const result = await client.query(
  "DELETE FROM users WHERE id = $1 AND email = 'parent@educore.staging'",
  [ORPHAN_ID],
);
process.stdout.write(`orphan parent user deleted: ${result.rowCount}\n`);
await client.end();
