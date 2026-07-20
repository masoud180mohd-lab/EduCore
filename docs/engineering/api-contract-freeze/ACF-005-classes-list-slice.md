# API Contract Freeze — Classes List + Detail + Create (ACF-005)

## Freeze status

| Field               | Value                                               |
| ------------------- | --------------------------------------------------- |
| Freeze ID           | `ACF-005`                                           |
| Title               | API Contract Freeze — classes list + get + create   |
| Version             | `1.2`                                               |
| Date                | 2026-07-21                                          |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001) |
| Companion DB freeze | DBF-005 (+ create helper)                           |

**Honesty qualifier:** Solo-operator provisional.

## Revision history

| Version | Date       | Notes                        |
| ------- | ---------- | ---------------------------- |
| 1.0     | 2026-07-21 | List only (`listClasses`)    |
| 1.1     | 2026-07-21 | `GET /classes/{id}` getClass |
| **1.2** | 2026-07-21 | `POST /classes` createClass  |

## Scope

| In scope                          | Out of scope                       |
| --------------------------------- | ---------------------------------- |
| GET list, GET detail, POST create | PATCH/DELETE, streams, enrollments |
| academic.read / academic.manage   | class.* invention                  |

## Endpoint: list

| Method | Path              | AuthZ                              |
| ------ | ----------------- | ---------------------------------- |
| GET    | `/api/v1/classes` | academic.read + session bind + RLS |

**operationId:** `listClasses`

Query: `limit`, `cursor`, `academicYearId?`, `termId?`, `status?`, `search?`  
Order: `name ASC, id ASC`  
Foreign/missing year/term UUID filters → empty page; non-UUID → 400.

## Endpoint: get by id (rev 1.1)

| Method | Path                        | AuthZ                              |
| ------ | --------------------------- | ---------------------------------- |
| GET    | `/api/v1/classes/{classId}` | academic.read + session bind + RLS |

**operationId:** `getClass` — Nest `:id`  
Miss/cross-tenant/invalid → 404 `Class not found.`

## Endpoint: create (rev 1.2)

| Method | Path              | AuthZ                          | Idempotency  |
| ------ | ----------------- | ------------------------------ | ------------ |
| POST   | `/api/v1/classes` | academic.manage + session bind | **Required** |

**operationId:** `createClass`

Body: `academicYearId` (required UUID), `termId?`, `name` (1–200), `code?`, `status?` default **draft**.  
Parent year missing/other-tenant → 400 `academicYearId not found in this tenant.`  
Parent term missing/wrong year/tenant → 400 on `termId`.  
Duplicate code → 409.  
Audit: `class.create`.

## Acceptance (solo-operator)

Signed 2026-07-21 (Backend / Security / Principal acting).

## Related

DBF-005; IMP-003-C0/C1/C2
