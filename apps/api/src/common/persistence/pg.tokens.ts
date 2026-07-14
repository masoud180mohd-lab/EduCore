/**
 * Tokens for Nest Postgres runtime (educore_app only).
 * Never inject migrator/platform/superuser pools into request paths.
 */
export const PG_POOL = Symbol('PG_POOL');

export const DATABASE_CONFIG = Symbol('DATABASE_CONFIG');
