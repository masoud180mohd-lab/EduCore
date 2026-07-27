-- IMP-025: Return structured dependency details from academic delete helpers.
-- Deletes remain empty-only; no dependent rows are cascaded.

CREATE OR REPLACE FUNCTION app.delete_academic_year(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_dependents jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM academic_years y WHERE y.id = p_id AND y.tenant_id = p_tenant_id
  ) THEN
    RETURN false;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', d.dependent_type,
      'count', d.dependent_count,
      'samples', d.samples
    )
    ORDER BY d.sort_order
  ), '[]'::jsonb)
  INTO v_dependents
  FROM (
    SELECT
      1 AS sort_order,
      'terms'::text AS dependent_type,
      count(*) AS dependent_count,
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sample.id, 'label', sample.name)
          ORDER BY sample.name, sample.id
        )
        FROM (
          SELECT t2.id, t2.name
          FROM terms t2
          WHERE t2.academic_year_id = p_id AND t2.tenant_id = p_tenant_id
          ORDER BY t2.name, t2.id
          LIMIT 5
        ) sample
      ) AS samples
    FROM terms t
    WHERE t.academic_year_id = p_id AND t.tenant_id = p_tenant_id
    HAVING count(*) > 0

    UNION ALL

    SELECT
      2,
      'classes',
      count(*),
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sample.id, 'label', sample.name)
          ORDER BY sample.name, sample.id
        )
        FROM (
          SELECT c2.id, c2.name
          FROM classes c2
          WHERE c2.academic_year_id = p_id AND c2.tenant_id = p_tenant_id
          ORDER BY c2.name, c2.id
          LIMIT 5
        ) sample
      )
    FROM classes c
    WHERE c.academic_year_id = p_id AND c.tenant_id = p_tenant_id
    HAVING count(*) > 0

    UNION ALL

    SELECT
      3,
      'enrollments',
      count(*),
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sample.id, 'label', 'Enrollment · ' || sample.status)
          ORDER BY sample.status, sample.id
        )
        FROM (
          SELECT e2.id, e2.status
          FROM enrollments e2
          WHERE e2.academic_year_id = p_id AND e2.tenant_id = p_tenant_id
          ORDER BY e2.status, e2.id
          LIMIT 5
        ) sample
      )
    FROM enrollments e
    WHERE e.academic_year_id = p_id AND e.tenant_id = p_tenant_id
    HAVING count(*) > 0

    UNION ALL

    SELECT
      4,
      'attendance_sessions',
      count(*),
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', sample.id,
            'label', 'Session · ' || sample.session_date::text
          )
          ORDER BY sample.session_date, sample.id
        )
        FROM (
          SELECT s2.id, s2.session_date
          FROM attendance_sessions s2
          WHERE s2.academic_year_id = p_id AND s2.tenant_id = p_tenant_id
          ORDER BY s2.session_date, s2.id
          LIMIT 5
        ) sample
      )
    FROM attendance_sessions s
    WHERE s.academic_year_id = p_id AND s.tenant_id = p_tenant_id
    HAVING count(*) > 0

    UNION ALL

    SELECT
      5,
      'exams',
      count(*),
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sample.id, 'label', sample.name)
          ORDER BY sample.name, sample.id
        )
        FROM (
          SELECT x2.id, x2.name
          FROM exams x2
          WHERE x2.academic_year_id = p_id AND x2.tenant_id = p_tenant_id
          ORDER BY x2.name, x2.id
          LIMIT 5
        ) sample
      )
    FROM exams x
    WHERE x.academic_year_id = p_id AND x.tenant_id = p_tenant_id
    HAVING count(*) > 0

    UNION ALL

    SELECT
      6,
      'fee_structures',
      count(*),
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sample.id, 'label', sample.name)
          ORDER BY sample.name, sample.id
        )
        FROM (
          SELECT f2.id, f2.name
          FROM fee_structures f2
          WHERE f2.academic_year_id = p_id AND f2.tenant_id = p_tenant_id
          ORDER BY f2.name, f2.id
          LIMIT 5
        ) sample
      )
    FROM fee_structures f
    WHERE f.academic_year_id = p_id AND f.tenant_id = p_tenant_id
    HAVING count(*) > 0

    UNION ALL

    SELECT
      7,
      'invoices',
      count(*),
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sample.id, 'label', 'Invoice · ' || sample.status)
          ORDER BY sample.status, sample.id
        )
        FROM (
          SELECT i2.id, i2.status
          FROM invoices i2
          WHERE i2.academic_year_id = p_id AND i2.tenant_id = p_tenant_id
          ORDER BY i2.status, i2.id
          LIMIT 5
        ) sample
      )
    FROM invoices i
    WHERE i.academic_year_id = p_id AND i.tenant_id = p_tenant_id
    HAVING count(*) > 0
  ) d;

  IF jsonb_array_length(v_dependents) > 0 THEN
    RAISE EXCEPTION 'has dependents'
      USING ERRCODE = 'P0001',
            DETAIL = jsonb_build_object('dependents', v_dependents)::text;
  END IF;

  DELETE FROM academic_years y WHERE y.id = p_id AND y.tenant_id = p_tenant_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app.delete_term(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_dependents jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM terms t WHERE t.id = p_id AND t.tenant_id = p_tenant_id
  ) THEN
    RETURN false;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', d.dependent_type,
      'count', d.dependent_count,
      'samples', d.samples
    )
    ORDER BY d.sort_order
  ), '[]'::jsonb)
  INTO v_dependents
  FROM (
    SELECT
      1 AS sort_order,
      'classes'::text AS dependent_type,
      count(*) AS dependent_count,
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sample.id, 'label', sample.name)
          ORDER BY sample.name, sample.id
        )
        FROM (
          SELECT c2.id, c2.name
          FROM classes c2
          WHERE c2.term_id = p_id AND c2.tenant_id = p_tenant_id
          ORDER BY c2.name, c2.id
          LIMIT 5
        ) sample
      ) AS samples
    FROM classes c
    WHERE c.term_id = p_id AND c.tenant_id = p_tenant_id
    HAVING count(*) > 0

    UNION ALL

    SELECT
      2,
      'enrollments',
      count(*),
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sample.id, 'label', 'Enrollment · ' || sample.status)
          ORDER BY sample.status, sample.id
        )
        FROM (
          SELECT e2.id, e2.status
          FROM enrollments e2
          WHERE e2.term_id = p_id AND e2.tenant_id = p_tenant_id
          ORDER BY e2.status, e2.id
          LIMIT 5
        ) sample
      )
    FROM enrollments e
    WHERE e.term_id = p_id AND e.tenant_id = p_tenant_id
    HAVING count(*) > 0

    UNION ALL

    SELECT
      3,
      'attendance_sessions',
      count(*),
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', sample.id,
            'label', 'Session · ' || sample.session_date::text
          )
          ORDER BY sample.session_date, sample.id
        )
        FROM (
          SELECT s2.id, s2.session_date
          FROM attendance_sessions s2
          WHERE s2.term_id = p_id AND s2.tenant_id = p_tenant_id
          ORDER BY s2.session_date, s2.id
          LIMIT 5
        ) sample
      )
    FROM attendance_sessions s
    WHERE s.term_id = p_id AND s.tenant_id = p_tenant_id
    HAVING count(*) > 0

    UNION ALL

    SELECT
      4,
      'exams',
      count(*),
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sample.id, 'label', sample.name)
          ORDER BY sample.name, sample.id
        )
        FROM (
          SELECT x2.id, x2.name
          FROM exams x2
          WHERE x2.term_id = p_id AND x2.tenant_id = p_tenant_id
          ORDER BY x2.name, x2.id
          LIMIT 5
        ) sample
      )
    FROM exams x
    WHERE x.term_id = p_id AND x.tenant_id = p_tenant_id
    HAVING count(*) > 0
  ) d;

  IF jsonb_array_length(v_dependents) > 0 THEN
    RAISE EXCEPTION 'has dependents'
      USING ERRCODE = 'P0001',
            DETAIL = jsonb_build_object('dependents', v_dependents)::text;
  END IF;

  DELETE FROM terms t WHERE t.id = p_id AND t.tenant_id = p_tenant_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app.delete_class(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_dependents jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM classes c WHERE c.id = p_id AND c.tenant_id = p_tenant_id
  ) THEN
    RETURN false;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', d.dependent_type,
      'count', d.dependent_count,
      'samples', d.samples
    )
    ORDER BY d.sort_order
  ), '[]'::jsonb)
  INTO v_dependents
  FROM (
    SELECT
      1 AS sort_order,
      'streams'::text AS dependent_type,
      count(*) AS dependent_count,
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sample.id, 'label', sample.name)
          ORDER BY sample.name, sample.id
        )
        FROM (
          SELECT s2.id, s2.name
          FROM streams s2
          WHERE s2.class_id = p_id AND s2.tenant_id = p_tenant_id
          ORDER BY s2.name, s2.id
          LIMIT 5
        ) sample
      ) AS samples
    FROM streams s
    WHERE s.class_id = p_id AND s.tenant_id = p_tenant_id
    HAVING count(*) > 0

    UNION ALL

    SELECT
      2,
      'enrollments',
      count(*),
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sample.id, 'label', 'Enrollment · ' || sample.status)
          ORDER BY sample.status, sample.id
        )
        FROM (
          SELECT e2.id, e2.status
          FROM enrollments e2
          WHERE e2.class_id = p_id AND e2.tenant_id = p_tenant_id
          ORDER BY e2.status, e2.id
          LIMIT 5
        ) sample
      )
    FROM enrollments e
    WHERE e.class_id = p_id AND e.tenant_id = p_tenant_id
    HAVING count(*) > 0

    UNION ALL

    SELECT
      3,
      'attendance_sessions',
      count(*),
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', sample.id,
            'label', 'Session · ' || sample.session_date::text
          )
          ORDER BY sample.session_date, sample.id
        )
        FROM (
          SELECT a2.id, a2.session_date
          FROM attendance_sessions a2
          WHERE a2.class_id = p_id AND a2.tenant_id = p_tenant_id
          ORDER BY a2.session_date, a2.id
          LIMIT 5
        ) sample
      )
    FROM attendance_sessions a
    WHERE a.class_id = p_id AND a.tenant_id = p_tenant_id
    HAVING count(*) > 0

    UNION ALL

    SELECT
      4,
      'exams',
      count(*),
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sample.id, 'label', sample.name)
          ORDER BY sample.name, sample.id
        )
        FROM (
          SELECT x2.id, x2.name
          FROM exams x2
          WHERE x2.class_id = p_id AND x2.tenant_id = p_tenant_id
          ORDER BY x2.name, x2.id
          LIMIT 5
        ) sample
      )
    FROM exams x
    WHERE x.class_id = p_id AND x.tenant_id = p_tenant_id
    HAVING count(*) > 0
  ) d;

  IF jsonb_array_length(v_dependents) > 0 THEN
    RAISE EXCEPTION 'has dependents'
      USING ERRCODE = 'P0001',
            DETAIL = jsonb_build_object('dependents', v_dependents)::text;
  END IF;

  DELETE FROM classes c WHERE c.id = p_id AND c.tenant_id = p_tenant_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app.delete_stream(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_dependents jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM streams s WHERE s.id = p_id AND s.tenant_id = p_tenant_id
  ) THEN
    RETURN false;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', d.dependent_type,
      'count', d.dependent_count,
      'samples', d.samples
    )
    ORDER BY d.sort_order
  ), '[]'::jsonb)
  INTO v_dependents
  FROM (
    SELECT
      1 AS sort_order,
      'enrollments'::text AS dependent_type,
      count(*) AS dependent_count,
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sample.id, 'label', 'Enrollment · ' || sample.status)
          ORDER BY sample.status, sample.id
        )
        FROM (
          SELECT e2.id, e2.status
          FROM enrollments e2
          WHERE e2.stream_id = p_id AND e2.tenant_id = p_tenant_id
          ORDER BY e2.status, e2.id
          LIMIT 5
        ) sample
      ) AS samples
    FROM enrollments e
    WHERE e.stream_id = p_id AND e.tenant_id = p_tenant_id
    HAVING count(*) > 0

    UNION ALL

    SELECT
      2,
      'attendance_sessions',
      count(*),
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', sample.id,
            'label', 'Session · ' || sample.session_date::text
          )
          ORDER BY sample.session_date, sample.id
        )
        FROM (
          SELECT a2.id, a2.session_date
          FROM attendance_sessions a2
          WHERE a2.stream_id = p_id AND a2.tenant_id = p_tenant_id
          ORDER BY a2.session_date, a2.id
          LIMIT 5
        ) sample
      )
    FROM attendance_sessions a
    WHERE a.stream_id = p_id AND a.tenant_id = p_tenant_id
    HAVING count(*) > 0
  ) d;

  IF jsonb_array_length(v_dependents) > 0 THEN
    RAISE EXCEPTION 'has dependents'
      USING ERRCODE = 'P0001',
            DETAIL = jsonb_build_object('dependents', v_dependents)::text;
  END IF;

  DELETE FROM streams s WHERE s.id = p_id AND s.tenant_id = p_tenant_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app.delete_subject(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_dependents jsonb;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM subjects s WHERE s.id = p_id AND s.tenant_id = p_tenant_id
  ) THEN
    RETURN false;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', d.dependent_type,
      'count', d.dependent_count,
      'samples', d.samples
    )
    ORDER BY d.sort_order
  ), '[]'::jsonb)
  INTO v_dependents
  FROM (
    SELECT
      1 AS sort_order,
      'exam_subjects'::text AS dependent_type,
      count(*) AS dependent_count,
      (
        SELECT jsonb_agg(
          jsonb_build_object('id', sample.id, 'label', sample.exam_name)
          ORDER BY sample.exam_name, sample.id
        )
        FROM (
          SELECT es2.id, x2.name AS exam_name
          FROM exam_subjects es2
          JOIN exams x2
            ON x2.id = es2.exam_id
           AND x2.tenant_id = es2.tenant_id
          WHERE es2.subject_id = p_id AND es2.tenant_id = p_tenant_id
          ORDER BY x2.name, es2.id
          LIMIT 5
        ) sample
      ) AS samples
    FROM exam_subjects es
    WHERE es.subject_id = p_id AND es.tenant_id = p_tenant_id
    HAVING count(*) > 0
  ) d;

  IF jsonb_array_length(v_dependents) > 0 THEN
    RAISE EXCEPTION 'has dependents'
      USING ERRCODE = 'P0001',
            DETAIL = jsonb_build_object('dependents', v_dependents)::text;
  END IF;

  DELETE FROM subjects s WHERE s.id = p_id AND s.tenant_id = p_tenant_id;
  RETURN true;
END;
$$;

COMMENT ON FUNCTION app.delete_academic_year(uuid, uuid, uuid) IS
  'IMP-025: Delete academic year if empty; P0001 DETAIL describes dependents.';

COMMENT ON FUNCTION app.delete_term(uuid, uuid, uuid) IS
  'IMP-025: Delete term if empty; P0001 DETAIL describes dependents.';

COMMENT ON FUNCTION app.delete_class(uuid, uuid, uuid) IS
  'IMP-025: Delete class if empty; P0001 DETAIL describes dependents.';

COMMENT ON FUNCTION app.delete_stream(uuid, uuid, uuid) IS
  'IMP-025: Delete stream if empty; P0001 DETAIL describes dependents.';

COMMENT ON FUNCTION app.delete_subject(uuid, uuid, uuid) IS
  'IMP-025: Delete subject if empty; P0001 DETAIL describes dependents.';
