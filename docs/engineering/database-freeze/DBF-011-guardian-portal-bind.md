# Database Freeze — Guardian portal bind (DBF-011)

| Field     | Value                                                            |
| --------- | ---------------------------------------------------------------- |
| Freeze ID | `DBF-011`                                                        |
| Version   | `1.0`                                                            |
| Date      | 2026-07-23                                                       |
| Companion | ACF-013                                                          |
| Amends    | DBF-010 (portal login / `user_id` was a non-goal — now unlocked) |
| Authority | Solo-operator provisional (SOLO-GOV-001)                         |
| Program   | **IMP-011-PX** / parent portal                                   |

**Honesty:** Provisional; does not re-accept kit-wide DBF.

## Goal

Bind a tenant **user** (with active membership) to a **guardian** directory row so the same AuthN session can open a parent portal. Staff (`guardian.manage`) performs the bind — no guardian self-signup in this slice.

## Schema amend — `guardians`

| Column    | Type                 | Notes                          |
| --------- | -------------------- | ------------------------------ |
| `user_id` | uuid NULL FK → users | Portal bind; cleared on unbind |

Constraints / indexes:

- Unique `(tenant_id, user_id)` WHERE `user_id IS NOT NULL` (one guardian per user per tenant)
- A guardian has at most one bound user (`user_id` single column)

## Helpers (SECURITY DEFINER)

| Function                                                      | Purpose                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `app.bind_guardian_user(actor, tenant, guardian_id, user_id)` | Set `user_id`; require active membership of target; assign system role `parent` |
| `app.unbind_guardian_user(actor, tenant, guardian_id)`        | Clear `user_id`; remove `parent` user_role only (leave membership)              |

Both require actor active membership. Writes remain educore_app via DEFINER only.

## System role — `parent`

Per-tenant system role `parent` with permissions:

| Code                   | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `parent.guardian.read` | Self guardian + links                     |
| `parent.finance.read`  | Scoped fees GETs for linked students only |

**Not** granted: `finance.read`, `finance.manage`, `guardian.manage`, bursar mutations.

Owner/admin continue to receive new permission codes via catalogue expand (read-only catalogue; they do not need parent.* for bursar path).

## Privileges

Unchanged SELECT-only for `educore_app` on `guardians`; bind/unbind via helpers.

## Non-goals

- Self-service guardian registration / magic-link invite UX beyond existing membership invite
- Soft national IDs / address PII
- MoMo / parent pay (PAY-PROVIDER-001)
- Widening bursar `finance.read` to parents

## Solo-operator honesty

Accepted under acting seats for IMP-011-PX.
