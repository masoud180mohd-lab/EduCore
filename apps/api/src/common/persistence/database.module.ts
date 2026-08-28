import { Global, Inject, Injectable, Module, type OnModuleDestroy, Optional } from '@nestjs/common';
import pg from 'pg';

import {
  loadDatabaseConfig,
  loadPlatformDatabaseConfig,
  loadWebhookDatabaseConfig,
  type DatabaseConfig,
} from './database-config.js';
import {
  DATABASE_CONFIG,
  PG_PLATFORM_POOL,
  PG_POOL,
  PG_WEBHOOK_POOL,
  PLATFORM_DATABASE_CONFIG,
  WEBHOOK_DATABASE_CONFIG,
} from './pg.tokens.js';

const { Pool } = pg;

@Injectable()
class DatabasePoolLifecycle implements OnModuleDestroy {
  constructor(
    @Optional() @Inject(PG_POOL) private readonly pool: pg.Pool | null,
    @Optional() @Inject(PG_WEBHOOK_POOL) private readonly webhookPool: pg.Pool | null,
    @Optional() @Inject(PG_PLATFORM_POOL) private readonly platformPool: pg.Pool | null,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.pool !== null ? this.pool.end() : Promise.resolve(),
      this.webhookPool !== null ? this.webhookPool.end() : Promise.resolve(),
      this.platformPool !== null ? this.platformPool.end() : Promise.resolve(),
    ]);
  }
}

/**
 * Optional Postgres pools for Nest runtime (`educore_app` + `educore_webhook` + `educore_platform`).
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
      provide: PLATFORM_DATABASE_CONFIG,
      useFactory: (): DatabaseConfig => loadPlatformDatabaseConfig(),
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
    {
      provide: PG_PLATFORM_POOL,
      inject: [PLATFORM_DATABASE_CONFIG],
      useFactory: (config: DatabaseConfig): pg.Pool | null => {
        if (!config.enabled || config.connectionString === undefined) {
          return null;
        }
        return new Pool({
          connectionString: config.connectionString,
          max: config.maxConnections,
          idleTimeoutMillis: config.idleTimeoutMillis,
          connectionTimeoutMillis: config.connectionTimeoutMillis,
          application_name: 'educore-api-platform',
        });
      },
    },
    DatabasePoolLifecycle,
  ],
  exports: [
    DATABASE_CONFIG,
    PG_POOL,
    WEBHOOK_DATABASE_CONFIG,
    PG_WEBHOOK_POOL,
    PLATFORM_DATABASE_CONFIG,
    PG_PLATFORM_POOL,
  ],
})
export class DatabaseModule {}
