/**
 * Tokens for Nest Postgres runtime.
 * Never inject migrator/superuser pools into request paths.
 * `PG_WEBHOOK_POOL` is educore_webhook only (F-017 ClickPesa ingest).
 * `PG_PLATFORM_POOL` is educore_platform only — platform-operations module,
 * behind PlatformOperatorGuard + MFA (ACF-PLAT-001 / DBF-PLAT-001).
 */
export const PG_POOL = Symbol('PG_POOL');

export const DATABASE_CONFIG = Symbol('DATABASE_CONFIG');

export const PG_WEBHOOK_POOL = Symbol('PG_WEBHOOK_POOL');

export const WEBHOOK_DATABASE_CONFIG = Symbol('WEBHOOK_DATABASE_CONFIG');

export const PG_PLATFORM_POOL = Symbol('PG_PLATFORM_POOL');

export const PLATFORM_DATABASE_CONFIG = Symbol('PLATFORM_DATABASE_CONFIG');
