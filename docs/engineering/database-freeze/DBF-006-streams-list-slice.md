# Database Freeze — Streams (DBF-006)

| Field     | Value                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| Freeze ID | `DBF-006`                                                                                                      |
| Version   | `1.3` (1.0 list; 1.1 create; 1.2 update helper IMP-013; 1.3 delete helper + reparent on update helper IMP-014) |
| Date      | 2026-07-21                                                                                                     |
| Authority | Solo-operator provisional (SOLO-GOV-001)                                                                       |

## Table `streams`

| Column                  | Type        | Constraints                                     |
| ----------------------- | ----------- | ----------------------------------------------- |
| id                      | uuid        | PK                                              |
| tenant_id               | uuid        | NOT NULL FK tenants                             |
| class_id                | uuid        | NOT NULL FK classes                             |
| name                    | text        | NOT NULL 1–200                                  |
| code                    | text        | NULL; unique (tenant_id, class_id) when present |
| status                  | text        | draft\|active\|closed                           |
| created_at / updated_at | timestamptz | NOT NULL default now()                          |

Indexes: unique code per class; (tenant_id, class_id, status); (tenant_id, class_id, name ASC).  
List order: `name ASC, id ASC`.  
RLS Pattern A; educore_app SELECT only.  
Write: `app.create_stream` SECURITY DEFINER; parent class same tenant.

### Delete helper (rev 1.3 / IMP-014)

`app.delete_stream(actor, tenant, id)` SECURITY DEFINER; membership + `academic.manage`; tenant-scoped; `RAISE foreign_key_violation` (mapped 409) when dependent rows exist (enrollments). Table DELETE remains REVOKED. No cascade.

### Reparent on update helper (rev 1.3 / IMP-014)

`app.update_stream` extended to accept optional `classId`; when set, re-validates parent class same tenant (same rule as create). Table UPDATE remains REVOKED (helper only). DELETE product HTTP no longer excluded.

## Permission

Reuses `academic.read` / `academic.manage`.
