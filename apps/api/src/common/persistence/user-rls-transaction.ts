import type { Pool, PoolClient } from 'pg';

/**
 * Short transaction with actor user GUC set (is_local=true).
 * Does **not** bind a single current_tenant — used for membership-scoped
 * cross-tenant reads (e.g. list tenants the user can access via RLS).
 */
export async function withUserRlsTransaction<T>(
  pool: Pool,
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user', $1, true)`, [userId]);
    await client.query(`SELECT set_config('app.rls_mode', 'tenant', true)`);
    await client.query(`SELECT set_config('app.is_platform_operator', 'false', true)`);
    // Leave app.current_tenant unset so can_see_tenant uses active membership OR paths.

    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}
