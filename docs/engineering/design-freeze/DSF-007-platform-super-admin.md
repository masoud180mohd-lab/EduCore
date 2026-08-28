# DSF-007 — Platform Super Admin Portal (screen inventory)

| Field     | Value                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------ |
| Freeze ID | `DSF-007`                                                                                                          |
| Version   | `1.0`                                                                                                              |
| Date      | 2026-08-15                                                                                                         |
| Status    | **Accepted — Owner GO in session 2026-08-15** (SOLO-GOV-003 gate form)                                             |
| Governing | SPEC-PORTALS-001 v1.0 (P1) · DSF-KIT-002 (PlatformShell) · DSF-KIT-001 tokens/states · ACF-PLAT-001 · DBF-PLAT-001 |

**Honesty:** Screen inventory for Phase 1a only. Platform Support role, support sessions UI, and metering dashboards are **out of this freeze** (Q8 default). Coding still requires ACF-PLAT-001 + DBF-PLAT-001 acceptance.

## Shell

`PlatformShell` per DSF-KIT-002: left rail, dense tables, identity tint `#134a6d`, wordmark `EduCore · Platform`. MFA-hard session; every write audited. No tenant header — platform context only. EN/SW catalog from day one (platform default EN per Q9).

Rail (Phase 1a subset of the SPEC nav):

```
EduCore Platform
├── Shule (Schools)
├── Bili & Mipango (Plans & entitlements — per-school panels in v1)
└── Ukaguzi (Audit)
```

`Support` and `Mipangilio` rail groups from SPEC-PORTALS-001 are deferred with the phases that need them.

## Screens (v1 inventory)

| #   | Screen          | Route                    | Contents / actions                                                                                                                                                                                                                                                     |
| --- | --------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Schools list    | `/platform`              | Table: name, code, status chip (draft/active/suspended/closed), plan, created. Filter by status. Cursor "Load more". Primary action: **Register school**.                                                                                                              |
| 2   | Register school | `/platform/tenants/new`  | Two-step form: (1) school — code, name, locale, timezone; (2) initial owner — email, display name. Confirm screen restates both. Success → detail.                                                                                                                     |
| 3   | School detail   | `/platform/tenants/[id]` | Profile panel; status panel with **Suspend / Reinstate** (ConfirmDialog, required reason, danger styling for suspend); plan panel (current plan + assign from catalog); entitlements panel (toggle rows per code, optional limit); recent audit slice for this tenant. |
| 4   | Platform audit  | `/platform/audit`        | Table: time, action, outcome, actor, tenant, resource. Cursor pagination. Filter by tenant and action. Read-only.                                                                                                                                                      |

## Required states (every screen)

Loading / empty / error / forbidden / offline / success per DSF-KIT-001 §6. Forbidden copy: platform capability missing → "Huna ruhusa ya jukwaa la mfumo" / "You do not have platform access."

## Confirmation & audit UX rules

- Suspend/reinstate and plan/entitlement changes always pass through `ConfirmDialog` with the tenant name restated and a required reason field (reason lands in the audit event).
- After any write, the detail screen shows a quiet success banner and the audit slice refreshes — no optimistic UI on platform writes.
- UUIDs follow the existing display-name pattern (name shown, UUID toggleable).

## Out of scope (this freeze)

Support sessions UI · metering/usage dashboards · platform settings/feature-flag catalog editor · tenant data browsing (explicitly denied by 32 §Explicit Deny) · billing invoices.

## Amendments

| Ver | Date       | Notes                      |
| --- | ---------- | -------------------------- |
| 1.0 | 2026-08-15 | Initial Phase 1a inventory |
