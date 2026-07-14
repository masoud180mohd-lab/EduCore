-- IMP-001-T05 (P1): Deterministic seeds for global catalogs (DBF-001 §13 + baseline plans).
-- Fixed UUIDs keep environments comparable; do not treat as secrets.

INSERT INTO permissions (id, code, description) VALUES
  ('01900000-0001-7000-8000-000000000001', 'tenant.read', 'Read tenant profile and current tenant context'),
  ('01900000-0001-7000-8000-000000000002', 'tenant.manage', 'Update tenant profile and settings'),
  ('01900000-0001-7000-8000-000000000003', 'organization.read', 'List and read organizations'),
  ('01900000-0001-7000-8000-000000000004', 'organization.manage', 'Create and update organizations'),
  ('01900000-0001-7000-8000-000000000005', 'user.invite', 'Invite users / create memberships'),
  ('01900000-0001-7000-8000-000000000006', 'user.read', 'Read users visible in tenant'),
  ('01900000-0001-7000-8000-000000000007', 'user.manage', 'Manage users and membership lifecycle'),
  ('01900000-0001-7000-8000-000000000008', 'role.read', 'Read roles and permission catalog'),
  ('01900000-0001-7000-8000-000000000009', 'role.manage', 'Manage roles and role assignments'),
  ('01900000-0001-7000-8000-00000000000a', 'session.revoke', 'Revoke sessions for other users'),
  ('01900000-0001-7000-8000-00000000000b', 'audit.read', 'Read audit events'),
  ('01900000-0001-7000-8000-00000000000c', 'entitlement.read', 'Read tenant entitlements'),
  ('01900000-0001-7000-8000-00000000000d', 'entitlement.manage', 'Manage tenant entitlements')
ON CONFLICT (code) DO NOTHING;

INSERT INTO plans (id, code, name, status) VALUES
  ('01900000-0002-7000-8000-000000000001', 'trial', 'Trial', 'active'),
  ('01900000-0002-7000-8000-000000000002', 'starter', 'Starter', 'active'),
  ('01900000-0002-7000-8000-000000000003', 'standard', 'Standard', 'active')
ON CONFLICT (code) DO NOTHING;
