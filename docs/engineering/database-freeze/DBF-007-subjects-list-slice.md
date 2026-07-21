# Database Freeze — Subjects (DBF-007)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Freeze ID | `DBF-007`                                |
| Version   | `1.1` (1.0 list; 1.1 create helper)      |
| Date      | 2026-07-21                               |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Table `subjects`

Tenant-scoped catalogue (not class-bound in v1).

| Column                  | Type        | Constraints                           |
| ----------------------- | ----------- | ------------------------------------- |
| id                      | uuid        | PK                                    |
| tenant_id               | uuid        | NOT NULL FK tenants                   |
| name                    | text        | NOT NULL 1–200                        |
| code                    | text        | NULL; unique (tenant_id) when present |
| status                  | text        | draft\|active\|closed                 |
| created_at / updated_at | timestamptz | NOT NULL default now()                |

Indexes: unique code per tenant; (tenant_id, status); (tenant_id, name ASC).  
List order: `name ASC, id ASC`.  
RLS Pattern A; educore_app SELECT only.  
Write: `app.create_subject` SECURITY DEFINER.

## Permission

Reuses `academic.read` / `academic.manage`.
