# Database Freeze — Guardians slice (DBF-010)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Freeze ID | `DBF-010`                                |
| Version   | `1.0`                                    |
| Date      | 2026-07-21                               |
| Companion | ACF-010                                  |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

**Honesty:** Provisional; not multi-party accepted.

## Goal

Tenant-owned guardian directory + link table to students (kit conceptual `guardians` / `student_guardians`).

## Tables

### `guardians`

| Column         | Type        | Notes                      |
| -------------- | ----------- | -------------------------- |
| `id`           | uuid PK     | Client/server UUID         |
| `tenant_id`    | uuid FK     | → `tenants`; RLS           |
| `display_name` | text        | 1–200                      |
| `phone`        | text NULL   | optional, ≤32              |
| `email`        | text NULL   | optional, ≤320, lowercased |
| `status`       | text        | `active` \| `inactive`     |
| `created_at`   | timestamptz |                            |
| `updated_at`   | timestamptz |                            |

Indexes: `(tenant_id, display_name)`, `(tenant_id, status)`; unique `(tenant_id, email)` where email not null.

### `student_guardians`

| Column              | Type        | Notes                                         |
| ------------------- | ----------- | --------------------------------------------- |
| `id`                | uuid PK     |                                               |
| `tenant_id`         | uuid FK     | RLS                                           |
| `student_id`        | uuid FK     | → `students`                                  |
| `guardian_id`       | uuid FK     | → `guardians`                                 |
| `relationship_type` | text        | `mother` \| `father` \| `guardian` \| `other` |
| `is_primary`        | boolean     | default false                                 |
| `status`            | text        | `active` \| `ended`                           |
| `created_at`        | timestamptz |                                               |
| `updated_at`        | timestamptz |                                               |

Unique active link: `(tenant_id, student_id, guardian_id)` where `status = 'active'`.

## Privileges

- `educore_app`: SELECT only on both tables; INSERT/UPDATE via SECURITY DEFINER helpers
- RLS: `tenant_id = app.current_tenant_id()` for SELECT
- Helpers require `app.auth_has_active_membership`

## Permissions

- `guardian.read` — list/get guardians + links (owner, admin, staff)
- `guardian.manage` — create/patch guardian + create/end links (owner, admin)

## Non-goals

- Portal login for guardians (no `user_id` bind in this slice)
- Soft national IDs / address PII
- Cascading student delete
- IAM `relationships` table (separate ACF-001 T33)

## Solo-operator honesty

Accepted under acting seats for IMP-007 Wave G.
