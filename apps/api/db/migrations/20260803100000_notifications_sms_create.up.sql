-- COMMS-003 / DBF-013: notifications SMS tables, permissions, seed templates, helpers.

CREATE TABLE notification_templates (
  id uuid PRIMARY KEY,
  tenant_id uuid NULL REFERENCES tenants (id),
  code text NOT NULL,
  channel text NOT NULL,
  locale text NOT NULL,
  version int NOT NULL,
  body text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_notification_templates_channel CHECK (channel = 'sms'),
  CONSTRAINT ck_notification_templates_locale CHECK (locale IN ('en', 'sw')),
  CONSTRAINT ck_notification_templates_version CHECK (version >= 1),
  CONSTRAINT ck_notification_templates_status CHECK (status IN ('active', 'retired')),
  CONSTRAINT ck_notification_templates_body_len CHECK (char_length(body) BETWEEN 1 AND 640)
);

CREATE UNIQUE INDEX uq_notification_templates_system
  ON notification_templates (code, channel, locale, version)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX uq_notification_templates_tenant
  ON notification_templates (tenant_id, code, channel, locale, version)
  WHERE tenant_id IS NOT NULL;

CREATE TABLE notification_requests (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  template_code text NOT NULL,
  template_version int NOT NULL,
  locale text NOT NULL,
  channel text NOT NULL,
  recipient_type text NOT NULL,
  recipient_id uuid NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,
  skip_reason text NULL,
  idempotency_key text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_notification_requests_channel CHECK (channel = 'sms'),
  CONSTRAINT ck_notification_requests_locale CHECK (locale IN ('en', 'sw')),
  CONSTRAINT ck_notification_requests_recipient_type CHECK (recipient_type = 'guardian'),
  CONSTRAINT ck_notification_requests_status CHECK (
    status IN ('accepted', 'queued', 'sending', 'succeeded', 'failed', 'skipped')
  ),
  CONSTRAINT uq_notification_requests_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX ix_notification_requests_tenant_created
  ON notification_requests (tenant_id, created_at DESC, id ASC);

CREATE TABLE notification_deliveries (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  request_id uuid NOT NULL REFERENCES notification_requests (id),
  provider_code text NOT NULL,
  provider_message_id text NULL,
  dest_e164 text NULL,
  phone_last4 text NULL,
  status text NOT NULL,
  segment_count int NULL,
  error_code text NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_notification_deliveries_status CHECK (
    status IN ('queued', 'submitted', 'sent', 'delivered', 'failed')
  ),
  CONSTRAINT ck_notification_deliveries_segments CHECK (
    segment_count IS NULL OR segment_count >= 1
  )
);

CREATE UNIQUE INDEX uq_notification_deliveries_provider_msg
  ON notification_deliveries (tenant_id, provider_code, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX ix_notification_deliveries_tenant_created
  ON notification_deliveries (tenant_id, created_at DESC, id ASC);

CREATE INDEX ix_notification_deliveries_request
  ON notification_deliveries (tenant_id, request_id);

CREATE TABLE notification_usage_daily (
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  usage_date date NOT NULL,
  channel text NOT NULL,
  sent_count int NOT NULL DEFAULT 0,
  segment_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, usage_date, channel),
  CONSTRAINT ck_notification_usage_channel CHECK (channel = 'sms'),
  CONSTRAINT ck_notification_usage_counts CHECK (sent_count >= 0 AND segment_count >= 0)
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_outbox_events_status CHECK (status IN ('pending', 'processed', 'failed')),
  CONSTRAINT ck_outbox_events_attempts CHECK (attempts >= 0)
);

CREATE INDEX ix_outbox_events_claim
  ON outbox_events (status, available_at ASC, id ASC)
  WHERE status = 'pending';

-- Seed system templates (COMMS-002 catalog v0.1)
INSERT INTO notification_templates (id, tenant_id, code, channel, locale, version, body, status) VALUES
  ('01900000-0002-7000-8000-000000000001', NULL, 'fee_invoice_issued', 'sms', 'en', 1,
   '{{school_name}}: Invoice issued for {{student_name}}. Total TZS {{amount_tzs}}, balance TZS {{balance_tzs}}. Ref {{invoice_ref}}.', 'active'),
  ('01900000-0002-7000-8000-000000000002', NULL, 'fee_invoice_issued', 'sms', 'sw', 1,
   '{{school_name}}: Ankara imetolewa kwa {{student_name}}. Jumla TZS {{amount_tzs}}, salio TZS {{balance_tzs}}. Ref {{invoice_ref}}.', 'active'),
  ('01900000-0002-7000-8000-000000000003', NULL, 'payment_received', 'sms', 'en', 1,
   '{{school_name}}: Payment TZS {{amount_tzs}} received for {{student_name}}. Balance TZS {{balance_tzs}}. Ref {{invoice_ref}}.', 'active'),
  ('01900000-0002-7000-8000-000000000004', NULL, 'payment_received', 'sms', 'sw', 1,
   '{{school_name}}: Malipo TZS {{amount_tzs}} yamepokelewa kwa {{student_name}}. Salio TZS {{balance_tzs}}. Ref {{invoice_ref}}.', 'active'),
  ('01900000-0002-7000-8000-000000000005', NULL, 'payment_momo_pending', 'sms', 'en', 1,
   '{{school_name}}: Pay TZS {{amount_tzs}} for {{student_name}} via mobile money. BillPay {{bill_pay}}. Ref {{invoice_ref}}.', 'active'),
  ('01900000-0002-7000-8000-000000000006', NULL, 'payment_momo_pending', 'sms', 'sw', 1,
   '{{school_name}}: Lipa TZS {{amount_tzs}} kwa {{student_name}} kwa simu. BillPay {{bill_pay}}. Ref {{invoice_ref}}.', 'active'),
  ('01900000-0002-7000-8000-000000000007', NULL, 'attendance_absent_digest', 'sms', 'en', 1,
   '{{school_name}}: {{student_name}} was marked absent on {{date}}. Contact the school if this is unexpected.', 'active'),
  ('01900000-0002-7000-8000-000000000008', NULL, 'attendance_absent_digest', 'sms', 'sw', 1,
   '{{school_name}}: {{student_name}} amewekwa absent tarehe {{date}}. Wasiliana na shule ikiwa si sahihi.', 'active'),
  ('01900000-0002-7000-8000-000000000009', NULL, 'comms_test_sms', 'sms', 'en', 1,
   '{{school_name}}: EduCore SMS test. If you received this, notifications are working.', 'active'),
  ('01900000-0002-7000-8000-00000000000a', NULL, 'comms_test_sms', 'sms', 'sw', 1,
   '{{school_name}}: Jaribio la SMS la EduCore. Ukipokea, arifa zinafanya kazi.', 'active');

INSERT INTO permissions (id, code, description) VALUES
  ('01900000-0001-7000-8000-000000000052', 'notification.read', 'Read notification templates, requests, and deliveries'),
  ('01900000-0001-7000-8000-000000000053', 'notification.manage', 'Create notification requests / enqueue SMS')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND r.code IN ('owner', 'admin', 'staff')
  AND p.code IN ('notification.read', 'notification.manage')
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE notification_templates TO educore_app;
    GRANT SELECT ON TABLE notification_requests TO educore_app;
    GRANT SELECT ON TABLE notification_deliveries TO educore_app;
    GRANT SELECT ON TABLE notification_usage_daily TO educore_app;
    GRANT SELECT ON TABLE outbox_events TO educore_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE notification_templates TO educore_platform;
    GRANT SELECT, INSERT, UPDATE ON TABLE notification_requests TO educore_platform;
    GRANT SELECT, INSERT, UPDATE ON TABLE notification_deliveries TO educore_platform;
    GRANT SELECT, INSERT, UPDATE ON TABLE notification_usage_daily TO educore_platform;
    GRANT SELECT, INSERT, UPDATE ON TABLE outbox_events TO educore_platform;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notification_templates TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notification_requests TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notification_deliveries TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notification_usage_daily TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE outbox_events TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE notification_templates FROM PUBLIC;
REVOKE ALL ON TABLE notification_requests FROM PUBLIC;
REVOKE ALL ON TABLE notification_deliveries FROM PUBLIC;
REVOKE ALL ON TABLE notification_usage_daily FROM PUBLIC;
REVOKE ALL ON TABLE outbox_events FROM PUBLIC;

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;

-- System templates (tenant_id NULL) readable by any tenant session; tenant rows scoped.
CREATE POLICY rls_notification_templates_select ON notification_templates
  FOR SELECT TO educore_app
  USING (tenant_id IS NULL OR tenant_id = app.current_tenant_id());

CREATE POLICY rls_notification_requests_select ON notification_requests
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

CREATE POLICY rls_notification_deliveries_select ON notification_deliveries
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

CREATE POLICY rls_notification_usage_daily_select ON notification_usage_daily
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

CREATE POLICY rls_outbox_events_select ON outbox_events
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

CREATE OR REPLACE FUNCTION app.create_notification_request(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_request_id uuid,
  p_template_code text,
  p_locale text,
  p_recipient_type text,
  p_recipient_id uuid,
  p_payload_json jsonb,
  p_idempotency_key text,
  p_daily_cap int,
  p_outbox_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  template_code text,
  template_version int,
  locale text,
  channel text,
  recipient_type text,
  recipient_id uuid,
  payload_json jsonb,
  status text,
  skip_reason text,
  dest_e164 text,
  phone_last4 text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_version int;
  v_phone text;
  v_last4 text;
  v_sent int;
  v_status text;
  v_skip text;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_request_id IS NULL
     OR p_template_code IS NULL OR p_locale IS NULL OR p_recipient_id IS NULL
     OR p_idempotency_key IS NULL OR p_outbox_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_recipient_type IS NULL OR p_recipient_type <> 'guardian' THEN
    RAISE EXCEPTION 'invalid recipient_type' USING ERRCODE = '22023';
  END IF;
  IF p_locale NOT IN ('en', 'sw') THEN
    RAISE EXCEPTION 'invalid locale' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT nt.version INTO v_version
  FROM notification_templates nt
  WHERE nt.tenant_id IS NULL
    AND nt.code = btrim(p_template_code)
    AND nt.channel = 'sms'
    AND nt.locale = p_locale
    AND nt.status = 'active'
  ORDER BY nt.version DESC
  LIMIT 1;

  IF v_version IS NULL THEN
    RAISE EXCEPTION 'template not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT g.phone INTO v_phone
  FROM guardians g
  WHERE g.id = p_recipient_id AND g.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'guardian not found' USING ERRCODE = 'P0002';
  END IF;

  v_phone := NULLIF(btrim(COALESCE(v_phone, '')), '');
  IF v_phone IS NULL THEN
    v_status := 'skipped';
    v_skip := 'no_phone';
    v_last4 := NULL;
  ELSE
    SELECT COALESCE(SUM(u.sent_count), 0) INTO v_sent
    FROM notification_usage_daily u
    WHERE u.tenant_id = p_tenant_id
      AND u.usage_date = (timezone('utc', now()))::date
      AND u.channel = 'sms';

    IF p_daily_cap IS NOT NULL AND p_daily_cap >= 0 AND v_sent >= p_daily_cap THEN
      v_status := 'skipped';
      v_skip := 'daily_cap';
      v_last4 := right(regexp_replace(v_phone, '[^0-9]', '', 'g'), 4);
    ELSE
      v_status := 'queued';
      v_skip := NULL;
      v_last4 := right(regexp_replace(v_phone, '[^0-9]', '', 'g'), 4);
    END IF;
  END IF;

  INSERT INTO notification_requests (
    id, tenant_id, template_code, template_version, locale, channel,
    recipient_type, recipient_id, payload_json, status, skip_reason,
    idempotency_key, created_by_user_id, created_at, updated_at
  ) VALUES (
    p_request_id, p_tenant_id, btrim(p_template_code), v_version, p_locale, 'sms',
    'guardian', p_recipient_id, COALESCE(p_payload_json, '{}'::jsonb), v_status, v_skip,
    btrim(p_idempotency_key), p_actor_user_id, now(), now()
  );

  IF v_status = 'queued' THEN
    INSERT INTO outbox_events (
      id, tenant_id, event_type, aggregate_type, aggregate_id, payload_json,
      status, attempts, available_at, created_at
    ) VALUES (
      p_outbox_id, p_tenant_id, 'notification.send_requested', 'notification_request', p_request_id,
      jsonb_build_object('requestId', p_request_id),
      'pending', 0, now(), now()
    );
  END IF;

  RETURN QUERY
  SELECT r.id, r.tenant_id, r.template_code, r.template_version, r.locale, r.channel,
         r.recipient_type, r.recipient_id, r.payload_json, r.status, r.skip_reason,
         v_phone, v_last4, r.created_at, r.updated_at
  FROM notification_requests r
  WHERE r.id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.complete_notification_send(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_request_id uuid,
  p_delivery_id uuid,
  p_provider_code text,
  p_provider_message_id text,
  p_dest_e164 text,
  p_phone_last4 text,
  p_delivery_status text,
  p_segment_count int,
  p_error_code text,
  p_error_message text
)
RETURNS TABLE (
  delivery_id uuid,
  request_status text,
  delivery_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_req_status text;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_request_id IS NULL
     OR p_delivery_id IS NULL OR p_provider_code IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF p_delivery_status NOT IN ('sent', 'failed', 'submitted') THEN
    RAISE EXCEPTION 'invalid delivery_status' USING ERRCODE = '22023';
  END IF;

  SELECT r.status INTO v_req_status
  FROM notification_requests r
  WHERE r.id = p_request_id AND r.tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_req_status IS NULL THEN
    RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_req_status NOT IN ('queued', 'sending') THEN
    RAISE EXCEPTION 'request not sendable' USING ERRCODE = '55000';
  END IF;

  INSERT INTO notification_deliveries (
    id, tenant_id, request_id, provider_code, provider_message_id,
    dest_e164, phone_last4, status, segment_count, error_code, error_message,
    created_at, updated_at
  ) VALUES (
    p_delivery_id, p_tenant_id, p_request_id, btrim(p_provider_code),
    NULLIF(btrim(COALESCE(p_provider_message_id, '')), ''),
    NULLIF(btrim(COALESCE(p_dest_e164, '')), ''),
    NULLIF(btrim(COALESCE(p_phone_last4, '')), ''),
    p_delivery_status,
    COALESCE(p_segment_count, 1),
    NULLIF(btrim(COALESCE(p_error_code, '')), ''),
    NULLIF(btrim(COALESCE(p_error_message, '')), ''),
    now(), now()
  );

  IF p_delivery_status IN ('sent', 'submitted') THEN
    INSERT INTO notification_usage_daily (tenant_id, usage_date, channel, sent_count, segment_count)
    VALUES (
      p_tenant_id, (timezone('utc', now()))::date, 'sms', 1, COALESCE(p_segment_count, 1)
    )
    ON CONFLICT (tenant_id, usage_date, channel) DO UPDATE
    SET sent_count = notification_usage_daily.sent_count + 1,
        segment_count = notification_usage_daily.segment_count + COALESCE(p_segment_count, 1);

    UPDATE notification_requests
    SET status = 'succeeded', updated_at = now()
    WHERE id = p_request_id AND tenant_id = p_tenant_id;

    UPDATE outbox_events
    SET status = 'processed', processed_at = now(), attempts = attempts + 1
    WHERE tenant_id = p_tenant_id
      AND aggregate_type = 'notification_request'
      AND aggregate_id = p_request_id
      AND status = 'pending';

    v_req_status := 'succeeded';
  ELSE
    UPDATE notification_requests
    SET status = 'failed', updated_at = now()
    WHERE id = p_request_id AND tenant_id = p_tenant_id;

    UPDATE outbox_events
    SET status = 'failed', attempts = attempts + 1, last_error = left(COALESCE(p_error_message, 'send failed'), 500)
    WHERE tenant_id = p_tenant_id
      AND aggregate_type = 'notification_request'
      AND aggregate_id = p_request_id
      AND status = 'pending';

    v_req_status := 'failed';
  END IF;

  RETURN QUERY SELECT p_delivery_id, v_req_status, p_delivery_status;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.create_notification_request(
      uuid, uuid, uuid, text, text, text, uuid, jsonb, text, int, uuid
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.complete_notification_send(
      uuid, uuid, uuid, uuid, text, text, text, text, text, int, text, text
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.create_notification_request(
  uuid, uuid, uuid, text, text, text, uuid, jsonb, text, int, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.complete_notification_send(
  uuid, uuid, uuid, uuid, text, text, text, text, text, int, text, text
) FROM PUBLIC;
