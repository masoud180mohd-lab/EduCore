import type { Pool, PoolClient } from 'pg';

export type PlatformSessionContext = {
  readonly userId: string;
};

/**
 * Trusted platform transaction (DBF-PLAT-001).
 * Caller MUST use the educore_platform pool — GUCs alone are not a bypass (AUDIT-R2).
 */
export async function withPlatformTransaction<T>(
  pool: Pool,
  ctx: PlatformSessionContext,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user', $1, true)`, [ctx.userId]);
    await client.query(`SELECT set_config('app.rls_mode', 'platform', true)`);
    await client.query(`SELECT set_config('app.is_platform_operator', 'true', true)`);

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
