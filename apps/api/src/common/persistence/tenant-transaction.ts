import type { Pool, PoolClient } from 'pg';

export type TenantSessionContext = {
  readonly userId: string;
  readonly tenantId: string;
};

/**
 * Runs `fn` inside a short transaction with RLS GUCs set **is_local=true**.
 * GUCs never stick on the pooled connection after COMMIT/ROLLBACK.
 */
export async function withTenantTransaction<T>(
  pool: Pool,
  ctx: TenantSessionContext,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_tenant', $1, true)`, [ctx.tenantId]);
    await client.query(`SELECT set_config('app.current_user', $1, true)`, [ctx.userId]);
    await client.query(`SELECT set_config('app.rls_mode', 'tenant', true)`);
    await client.query(`SELECT set_config('app.is_platform_operator', 'false', true)`);

    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors; original error is authoritative
    }
    throw error;
  } finally {
    client.release();
  }
}
