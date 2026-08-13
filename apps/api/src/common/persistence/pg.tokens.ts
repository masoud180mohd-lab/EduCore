/**
 * Tokens for Nest Postgres runtime.
 * Never inject migrator/platform/superuser pools into request paths.
 * `PG_WEBHOOK_POOL` is educore_webhook only (F-017 ClickPesa ingest).
 */
export const PG_POOL = Symbol('PG_POOL');

export const DATABASE_CONFIG = Symbol('DATABASE_CONFIG');

export const PG_WEBHOOK_POOL = Symbol('PG_WEBHOOK_POOL');

export const WEBHOOK_DATABASE_CONFIG = Symbol('WEBHOOK_DATABASE_CONFIG');
