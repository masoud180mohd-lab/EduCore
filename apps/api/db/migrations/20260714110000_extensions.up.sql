-- IMP-001-T05 (P1): PostgreSQL extensions required by DBF-001 catalogs / future IAM.
-- No business tables in this migration.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;
