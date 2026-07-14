# 07 Design System

## Design Goal

EduCore should feel calm, fast, reliable, and professional. It is an operations platform for schools, not a marketing website.

## Design Principles

- Mobile-first for teachers and parents.
- Dense but readable dashboards for admins.
- Common tasks must be visible.
- Offline state must always be clear.
- Avoid decorative complexity.
- Prioritize scanning, comparison, and repeated action.
- Support Kiswahili and English without layout breaking.
- Design for low-end Android devices.

## Primary Experiences

### Teacher

Teacher screens must be fast:

- Today's classes.
- Attendance capture.
- Marks entry.
- Offline queue.
- Sync status.

### Parent

Parent screens must be simple:

- Select child.
- Fee balance.
- Pay fees.
- Attendance.
- Results.
- Messages.
- Receipts.

### Headmaster

Headmaster screens must show decisions:

- Attendance rate.
- Fee collection.
- Payment failures.
- Academic performance.
- At-risk students.
- Notification delivery.
- Operational alerts.

### Accountant / Bursar

Finance screens must be precise:

- Invoices.
- Payments.
- Receipts.
- Reconciliation.
- Ledger.
- Exceptions.

## UI Components

Use:

- Tables for operational lists.
- Filters and saved views.
- Tabs for related data.
- Stepper/wizard for setup.
- Alerts for exceptions.
- Badges for statuses.
- Toasts for quick feedback.
- Modals for focused confirmation.
- Empty states with clear next action.

Avoid:

- Marketing-style hero pages inside the app.
- Large decorative cards for operational screens.
- Hidden controls for common tasks.
- Vague AI explanations.

## Status Language

Use precise statuses:

- Draft
- Pending approval
- Approved
- Rejected
- Synced
- Sync failed
- Conflict
- Pending payment
- Paid
- Reconciled
- Failed

## Offline UX

Offline mode must show:

- Device is offline.
- Number of pending operations.
- Last successful sync time.
- Conflicts needing review.
- Actions unavailable offline.

Never pretend offline data is fully confirmed until the server accepts it.

## Accessibility

Target WCAG 2.1 AA:

- Keyboard navigation.
- Clear focus states.
- Sufficient contrast.
- Labels for form fields.
- Error text tied to inputs.
- No color-only status communication.

## Language And Tone

Use plain language.

Examples:

- "Payment received"
- "Attendance saved on this device"
- "Sync failed. Try again when internet is available"
- "This mark needs approval"

Avoid technical terms in user-facing text unless the user is an admin.

