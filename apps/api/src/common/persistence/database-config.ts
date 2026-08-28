/**
 * Optional Nest runtime database config for the `educore_app` role only.
 * Secrets must never be logged or included in AppConfig dumps.
 */
export type DatabaseConfig = {
  /** When false, Nest keeps DenyAll membership (no pool). */
  readonly enabled: boolean;
  /** Connection string for `educore_app` — present only when enabled. */
  readonly connectionString?: string;
  readonly maxConnections: number;
  readonly idleTimeoutMillis: number;
  readonly connectionTimeoutMillis: number;
};

const DEFAULT_LOCAL_APP_URL =
  'postgresql://educore_app:educore_app_local_only@127.0.0.1:5432/educore';

const DEFAULT_LOCAL_WEBHOOK_URL =
  'postgresql://educore_webhook:educore_webhook_local_only@127.0.0.1:5432/educore';

const DEFAULT_LOCAL_PLATFORM_URL =
  'postgresql://educore_platform:educore_platform_local_only@127.0.0.1:5432/educore';

/**
 * Resolves optional `educore_app` connectivity.
 *
 * Enable when:
 * - `EDUCORE_APP_DATABASE_URL` is set, or
 * - `EDUCORE_ENABLE_APP_DB=1` (uses default local DEV-001 app role URL).
 *
 * Do **not** fall back to generic `DATABASE_URL` (often migrator/superuser).
 */
export function loadDatabaseConfig(environment: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const explicit = environment['EDUCORE_APP_DATABASE_URL']?.trim();
  const enableFlag = environment['EDUCORE_ENABLE_APP_DB'] === '1';

  if ((explicit === undefined || explicit === '') && !enableFlag) {
    return {
      enabled: false,
      maxConnections: 10,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 2_000,
    };
  }

  const connectionString =
    explicit !== undefined && explicit !== '' ? explicit : DEFAULT_LOCAL_APP_URL;

  return {
    enabled: true,
    connectionString,
    maxConnections: parsePositiveInt(environment['EDUCORE_APP_DB_POOL_MAX'], 10),
    idleTimeoutMillis: parsePositiveInt(environment['EDUCORE_APP_DB_IDLE_MS'], 10_000),
    connectionTimeoutMillis: parsePositiveInt(environment['EDUCORE_APP_DB_CONNECT_MS'], 2_000),
  };
}

/**
 * Optional Nest pool for ClickPesa ingest (`educore_webhook` only).
 * Do **not** fall back to `EDUCORE_APP_DATABASE_URL` (F-017).
 */
export function loadWebhookDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  const explicit = environment['EDUCORE_WEBHOOK_DATABASE_URL']?.trim();
  const enableFlag = environment['EDUCORE_ENABLE_APP_DB'] === '1';

  if ((explicit === undefined || explicit === '') && !enableFlag) {
    return {
      enabled: false,
      maxConnections: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 2_000,
    };
  }

  const connectionString =
    explicit !== undefined && explicit !== '' ? explicit : DEFAULT_LOCAL_WEBHOOK_URL;

  return {
    enabled: true,
    connectionString,
    maxConnections: parsePositiveInt(environment['EDUCORE_WEBHOOK_DB_POOL_MAX'], 5),
    idleTimeoutMillis: parsePositiveInt(environment['EDUCORE_APP_DB_IDLE_MS'], 10_000),
    connectionTimeoutMillis: parsePositiveInt(environment['EDUCORE_APP_DB_CONNECT_MS'], 2_000),
  };
}

/**
 * Optional Nest pool for Platform Operations (`educore_platform` only).
 * Do **not** fall back to `EDUCORE_APP_DATABASE_URL` (AUDIT-R2).
 */
export function loadPlatformDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  const explicit = environment['EDUCORE_PLATFORM_DATABASE_URL']?.trim();
  const enableFlag = environment['EDUCORE_ENABLE_APP_DB'] === '1';

  if ((explicit === undefined || explicit === '') && !enableFlag) {
    return {
      enabled: false,
      maxConnections: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 2_000,
    };
  }

  const connectionString =
    explicit !== undefined && explicit !== '' ? explicit : DEFAULT_LOCAL_PLATFORM_URL;

  return {
    enabled: true,
    connectionString,
    maxConnections: parsePositiveInt(environment['EDUCORE_PLATFORM_DB_POOL_MAX'], 5),
    idleTimeoutMillis: parsePositiveInt(environment['EDUCORE_APP_DB_IDLE_MS'], 10_000),
    connectionTimeoutMillis: parsePositiveInt(environment['EDUCORE_APP_DB_CONNECT_MS'], 2_000),
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('Database pool numeric env vars must be positive integers.');
  }
  return n;
}
