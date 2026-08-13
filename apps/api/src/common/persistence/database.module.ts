import { Global, Inject, Injectable, Module, type OnModuleDestroy, Optional } from '@nestjs/common';
import pg from 'pg';

import {
  loadDatabaseConfig,
  loadWebhookDatabaseConfig,
  type DatabaseConfig,
} from './database-config.js';
import { DATABASE_CONFIG, PG_POOL, PG_WEBHOOK_POOL, WEBHOOK_DATABASE_CONFIG } from './pg.tokens.js';

const { Pool } = pg;

@Injectable()
class DatabasePoolLifecycle implements OnModuleDestroy {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: pg.Pool | null,
    @Optional() @Inject(PG_WEBHOOK_POOL) private readonly webhookPool: pg.Pool | null,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.pool !== null ? this.pool.end() : Promise.resolve(),
      this.webhookPool !== null ? this.webhookPool.end() : Promise.resolve(),
    ]);
  }
}

/**
 * Optional Postgres pools for Nest runtime (`educore_app` + `educore_webhook`).
 * When disabled (default in CI), pools are `null` and membership stays DenyAll.
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONFIG,
      useFactory: (): DatabaseConfig => loadDatabaseConfig(),
    },
    {
      provide: WEBHOOK_DATABASE_CONFIG,
      useFactory: (): DatabaseConfig => loadWebhookDatabaseConfig(),
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
    {
      provide: PG_WEBHOOK_POOL,
      inject: [WEBHOOK_DATABASE_CONFIG],
      useFactory: (config: DatabaseConfig): pg.Pool | null => {
        if (!config.enabled || config.connectionString === undefined) {
          return null;
        }
        return new Pool({
          connectionString: config.connectionString,
          max: config.maxConnections,
          idleTimeoutMillis: config.idleTimeoutMillis,
          connectionTimeoutMillis: config.connectionTimeoutMillis,
          application_name: 'educore-api-webhook',
        });
      },
    },
    DatabasePoolLifecycle,
  ],
  exports: [DATABASE_CONFIG, PG_POOL, WEBHOOK_DATABASE_CONFIG, PG_WEBHOOK_POOL],
})
export class DatabaseModule {}
