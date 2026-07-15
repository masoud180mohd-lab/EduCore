DROP FUNCTION IF EXISTS app.auth_rotate_session_tokens(uuid, text, text, text, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS app.auth_revoke_session(uuid, uuid);
DROP FUNCTION IF EXISTS app.auth_touch_session(uuid);
DROP FUNCTION IF EXISTS app.auth_find_session_by_refresh_hash(text);
DROP FUNCTION IF EXISTS app.auth_find_session_by_access_hash(text);
DROP FUNCTION IF EXISTS app.auth_create_session(uuid, uuid, uuid, text, text, timestamptz, timestamptz, inet, text);
DROP FUNCTION IF EXISTS app.auth_has_active_membership(uuid, uuid);
DROP FUNCTION IF EXISTS app.auth_list_active_membership_tenants(uuid);
DROP FUNCTION IF EXISTS app.auth_lookup_user_by_email(citext);

DROP POLICY IF EXISTS rls_sessions_update ON sessions;
DROP POLICY IF EXISTS rls_sessions_select_platform ON sessions;
DROP POLICY IF EXISTS rls_sessions_select ON sessions;

DROP TABLE IF EXISTS sessions;
