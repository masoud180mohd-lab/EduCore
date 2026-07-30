# Manual QA — IMP-029 AdminShell nav IA

Lab: admin `admin@educore.local` / `ChangeMe-Local-Only-1`; optional finance-only staff if seeded.

**2026-07-28:** Source/static checks PASS (`scripts/manual-qa-admin-polish.ts`). Headless browser PASS for owner @ 768px, grouped nav, Fees current, no overflow (`scripts/manual-qa-admin-browser.ts`). Finance-only + keyboard @ 1280 still need GUI if desired.

## Owner @ 768px

1. Open Admin at viewport **768×1024**.
2. Confirm header: brand, grouped nav (Home / Registry / Access / Academic / Fees / Settings), Log out.
3. Confirm **no horizontal scroll** of the page/shell for the nav.
4. Tap each group link — lands on correct route; `aria-current` / underline on active.
5. Open `/admin/fees/invoices` (or an invoice detail) — **Fees** remains current.

## Owner @ 1280px

1. Same groups remain scannable; not a marketing sidebar.
2. Log out still reachable without colliding into content.

## Finance-only (if available)

1. Sign in as staff with `finance.*` only (no user/role/tenant manage).
2. Confirm groups: **Home**, **Fees** only — no Access / Users / Roles / Settings.
3. Direct URL to `/admin/users` still blocked by page AuthZ (403 banner) — nav must not offer it.

## Keyboard

1. Tab through brand → group links → Log out in a sensible order.
2. No hover-only access to any domain link.

## Denied (attendance-only / parent)

1. Confirm IMP-033 denied panel still appears — no grouped privileged chrome.
