# Manual QA — IMP-011 Guardian fees (read-only)

Audience: bursar/admin with `guardian.*` + `finance.read`.

## Happy path

1. Admin → Guardians → open guardian → **View fees (read-only)**.
2. If no active links: expect “Link a student…”.
3. Link a student on guardian detail → return to fees → student appears.
4. Open student → invoices list (status chip + balanceMinor display).
5. Open invoice → lines + total + balance; **no** Issue/Void/Pay/Reverse/Reconcile.
6. After office pay on bursar fees UI → refresh guardian invoice → balance updated; payment row + receipt link.
7. Open receipt → number + amount; **no** Reconcile.

## Isolation

1. Guardian A linked to student S1; Guardian B linked to S2 only.
2. From Guardian A fees, attempt URL with S2 or S2’s invoice id → isolation error.
3. Never see tenant-wide invoice list on guardian fees entry.

## AuthZ

1. Session without finance.read → 403 copy: finance / guardian access.
2. Unauthenticated → redirected/sign-in path as elsewhere.

## Honesty

1. Persistent banner cites PAY-PROVIDER-001 / pay at office.
2. No MoMo checkout route under `/parent`.
