# SMS template catalog (COMMS-002)

| Field     | Value                                     |
| --------- | ----------------------------------------- |
| Program   | **COMMS-002** / EPIC-COMMS-01             |
| Date      | 2026-08-03                                |
| Status    | **Accepted catalog v0.1** (solo-operator) |
| Depends   | COMMS-001 Accepted (Beem)                 |
| Channel   | SMS only                                  |
| Authority | Solo-operator provisional (SOLO-GOV-001)  |

## Rules

1. Bodies are **versioned templates** — no AI-generated free text in MVP.
2. Placeholders must be from the **allowlist** for that template; unknown keys → reject request.
3. Keep SMS short: aim **≤160 GSM-7 characters** for single segment; document if template may multi-segment.
4. Locales: **`en`** + **`sw`** stubs (same placeholders).
5. Do not put student full name + full fee amount + school name in ways that overshare on shared phones — keep practical for parents.
6. Rendering happens server-side; never log full body + full phone together.

## Global placeholder types

| Token               | Meaning                                  | Source                          |
| ------------------- | ---------------------------------------- | ------------------------------- |
| `{{school_name}}`   | Tenant display name                      | tenant settings / org           |
| `{{student_name}}`  | Student display name                     | student registry                |
| `{{guardian_name}}` | Guardian display name                    | guardians                       |
| `{{amount_tzs}}`    | Major TZS string (e.g. `150000.00`)      | derived from `amountMinor`      |
| `{{invoice_ref}}`   | Short invoice id or receipt-friendly ref | invoice / payment               |
| `{{bill_pay}}`      | MoMo BillPay / control number            | payment `providerRef` when MoMo |
| `{{date}}`          | Local date `YYYY-MM-DD`                  | event / attendance day          |
| `{{balance_tzs}}`   | Invoice balance major                    | `balanceMinor`                  |

## Catalog

### 1. `fee_invoice_issued`

| Field        | Value                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Code         | `fee_invoice_issued`                                                                             |
| When         | After invoice **issue** (revenue recognized) — v1 may be **manual admin notify** or domain event |
| Audience     | Linked guardians with phone                                                                      |
| Allowlist    | `school_name`, `student_name`, `amount_tzs`, `balance_tzs`, `invoice_ref`                        |
| Max guidance | Prefer 1 segment                                                                                 |

**en**

```text
{{school_name}}: Invoice issued for {{student_name}}. Total TZS {{amount_tzs}}, balance TZS {{balance_tzs}}. Ref {{invoice_ref}}.
```

**sw**

```text
{{school_name}}: Ankara imetolewa kwa {{student_name}}. Jumla TZS {{amount_tzs}}, salio TZS {{balance_tzs}}. Ref {{invoice_ref}}.
```

### 2. `payment_received`

| Field        | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| Code         | `payment_received`                                                        |
| When         | Payment attempt **succeeded** (office or MoMo complete)                   |
| Audience     | Linked guardians with phone                                               |
| Allowlist    | `school_name`, `student_name`, `amount_tzs`, `balance_tzs`, `invoice_ref` |
| Max guidance | Prefer 1 segment                                                          |

**en**

```text
{{school_name}}: Payment TZS {{amount_tzs}} received for {{student_name}}. Balance TZS {{balance_tzs}}. Ref {{invoice_ref}}.
```

**sw**

```text
{{school_name}}: Malipo TZS {{amount_tzs}} yamepokelewa kwa {{student_name}}. Salio TZS {{balance_tzs}}. Ref {{invoice_ref}}.
```

### 3. `payment_momo_pending`

| Field        | Value                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| Code         | `payment_momo_pending`                                                 |
| When         | MoMo BillPay created (pending) — bursar-assisted or system             |
| Audience     | Guardian(s) for that student                                           |
| Allowlist    | `school_name`, `student_name`, `amount_tzs`, `bill_pay`, `invoice_ref` |
| Max guidance | May be 1–2 segments if BillPay long                                    |

**en**

```text
{{school_name}}: Pay TZS {{amount_tzs}} for {{student_name}} via mobile money. BillPay {{bill_pay}}. Ref {{invoice_ref}}.
```

**sw**

```text
{{school_name}}: Lipa TZS {{amount_tzs}} kwa {{student_name}} kwa simu. BillPay {{bill_pay}}. Ref {{invoice_ref}}.
```

### 4. `attendance_absent_digest`

| Field        | Value                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Code         | `attendance_absent_digest`                                                                          |
| When         | End-of-day / session digest when student marked **absent** (v1: optional trigger; catalog reserved) |
| Audience     | Primary guardian with phone                                                                         |
| Allowlist    | `school_name`, `student_name`, `date`                                                               |
| Max guidance | 1 segment                                                                                           |

**en**

```text
{{school_name}}: {{student_name}} was marked absent on {{date}}. Contact the school if this is unexpected.
```

**sw**

```text
{{school_name}}: {{student_name}} amewekwa absent tarehe {{date}}. Wasiliana na shule ikiwa si sahihi.
```

### 5. `comms_test_sms`

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| Code         | `comms_test_sms`                          |
| When         | Admin **Send test SMS** only              |
| Audience     | Explicit guardian or validated test phone |
| Allowlist    | `school_name`                             |
| Max guidance | 1 segment                                 |

**en**

```text
{{school_name}}: EduCore SMS test. If you received this, notifications are working.
```

**sw**

```text
{{school_name}}: Jaribio la SMS la EduCore. Ukipokea, arifa zinafanya kazi.
```

## v1 trigger choice (locked for COMMS-003)

**Smallest path:** Admin/API **manual notify** using `comms_test_sms` and optionally `payment_received` / `fee_invoice_issued` by request — **not** automatic domain wiring in the first Nest slice.

Automatic payment/attendance hooks = follow-on after Fake path + ledger work.

## Non-goals

- WhatsApp templates
- Marketing / blast catalogs
- Per-school free-form template editor in MVP (seed catalog only; edit later)

## Solo-operator honesty

Provisional copy for lab; schools may amend wording later via catalog version bump (new `version`, do not mutate sent history).
