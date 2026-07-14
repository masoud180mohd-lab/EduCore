# 09 Frontend Guidelines

## Web Stack

- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- TanStack Query.
- Zustand only for small global UI state.

## Mobile Stack

- React Native.
- Expo.
- SQLite / WatermelonDB where offline is required.

## Frontend Principles

- Build workflows, not isolated screens.
- Keep daily tasks fast.
- Use role-specific navigation.
- Make offline state visible.
- Do not trust frontend for authorization.
- Make errors recoverable.
- Design for low bandwidth.

## Data Fetching

Use TanStack Query for:

- server state.
- caching.
- retries.
- optimistic UI where safe.

Do not use optimistic updates for:

- payments.
- ledger state.
- marks approval.
- role changes.

## Forms

Forms must:

- validate client-side for speed.
- validate server-side for truth.
- show field-level errors.
- preserve user input on failure.
- support slow network states.

## Offline Frontend

Offline support is allowed only for approved workflows:

- attendance.
- marks after phase approval.
- remarks later.

Offline UI must show:

- saved locally.
- pending sync.
- synced.
- conflict.
- failed.

## Security

Frontend must:

- use secure token handling.
- avoid local storage for sensitive tokens.
- avoid rendering unauthorized data.
- clear local offline data on logout where needed.
- protect shared devices.

## Performance Budgets

Frontend must consider:

- low-end Android phones.
- small screens.
- 3G network.
- large student lists.
- translated text length.

Use pagination, virtualization, and BFF endpoints for dashboards.

## i18n

All user-facing text must be translation-ready.

Initial languages:

- Kiswahili.
- English.

Avoid hardcoded dates, currencies, and plural forms.

