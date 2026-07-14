-- IMP-001-T06 (P1): Root identity/tenancy tables (DBF-001).
-- Membership bridge (tenant_memberships) intentionally deferred; RLS uses GUC patterns B/C
-- with an extension hook for membership EXISTS (next increment).

CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  primary_locale text NOT NULL DEFAULT 'en',
  timezone text NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenants_code UNIQUE (code),
  CONSTRAINT ck_tenants_code_format CHECK (code ~ '^[a-z0-9-]{3,64}$'),
  CONSTRAINT ck_tenants_status CHECK (status IN ('draft', 'active', 'suspended', 'closed'))
);

COMMENT ON TABLE tenants IS
  'Tenant And Billing root. RLS Pattern B (current tenant / platform / future membership).';

CREATE INDEX ix_tenants_status ON tenants (status);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email citext NOT NULL,
  email_verified_at timestamptz NULL,
  display_name text NOT NULL,
  status text NOT NULL,
  password_hash text NULL,
  external_subject_id text NULL,
  last_login_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT uq_users_external_subject_id UNIQUE (external_subject_id),
  CONSTRAINT ck_users_status CHECK (status IN ('invited', 'active', 'disabled', 'locked')),
  CONSTRAINT ck_users_display_name_len CHECK (char_length(display_name) BETWEEN 1 AND 200)
);

COMMENT ON TABLE users IS
  'Identity And Access global user. RLS Pattern C (self / platform / future membership-in-tenant).';

COMMENT ON COLUMN users.password_hash IS
  'Credential-like. Never log or return via API. Optional when OIDC-only.';

CREATE INDEX ix_users_status ON users (status);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE tenants TO educore_app;
    GRANT SELECT, INSERT, UPDATE ON TABLE users TO educore_app;
    -- No DELETE for runtime role (fail closed on hard delete).
    REVOKE DELETE ON TABLE tenants FROM educore_app;
    REVOKE DELETE ON TABLE users FROM educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenants TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO educore_migrator;
  END IF;
END
$$;
