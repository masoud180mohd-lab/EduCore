import { Global, Inject, Injectable, Module, type OnModuleDestroy, Optional } from '@nestjs/common';
import pg from 'pg';

import { loadDatabaseConfig, type DatabaseConfig } from './database-config.js';
import { DATABASE_CONFIG, PG_POOL } from './pg.tokens.js';

const { Pool } = pg;

@Injectable()
class DatabasePoolLifecycle implements OnModuleDestroy {
  constructor(@Optional() @Inject(PG_POOL) private readonly pool: pg.Pool | null) {}

  async onModuleDestroy(): Promise<void> {
    if (this.pool !== null) {
      await this.pool.end();
    }
  }
}

/**
 * Optional Postgres pool for Nest runtime (`educore_app` only).
 * When disabled (default in CI), `PG_POOL` is `null` and membership stays DenyAll.
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONFIG,
      useFactory: (): DatabaseConfig => loadDatabaseConfig(),
    },
    {
      provide: PG_POOL,
      inject: [DATABASE_CONFIG],
      useFactory: (config: DatabaseConfig): pg.Pool | null => {
        if (!config.enabled || config.connectionString === undefined) {
          return null;
        }
        return new Pool({
          connectionString: config.connectionString,
          max: config.maxConnections,
          idleTimeoutMillis: config.idleTimeoutMillis,
          connectionTimeoutMillis: config.connectionTimeoutMillis,
          application_name: 'educore-api',
        });
      },
    },
    DatabasePoolLifecycle,
  ],
  exports: [DATABASE_CONFIG, PG_POOL],
})
export class DatabaseModule {}
