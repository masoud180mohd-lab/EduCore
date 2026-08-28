# Manual QA — IMP-046 Admin office console

Lab or live: admin for the bound tenant. Same AuthZ as IMP-033.

## Owner @ 1280px

1. Open Admin. Confirm **left rail** (EduCore / Office + grouped links) and **top bar** (school name, Log out).
2. Confirm no wrapped strip of ~10 peer links across the header.
3. Current page uses `aria-current="page"` (teal hairline on the rail). Deep `/admin/fees/invoices` still marks Fees.
4. Tables use the wider workspace (not a 56rem centered column).

## Owner @ 768px

1. Rail remains visible (tablet breakpoint). No horizontal page scroll for nav.
2. Links remain ≥44px tall.

## Owner @ 390px

1. Rail is hidden; **Menu** opens overlay; Esc / scrim closes.
2. Log out remains in the top bar.

## Finance-only (if available)

1. Rail shows only permitted groups (Home + Fees typical). No Users / Roles / Settings.

## Denied

1. Attendance-only / parent still see Admin unavailable — no rail.
