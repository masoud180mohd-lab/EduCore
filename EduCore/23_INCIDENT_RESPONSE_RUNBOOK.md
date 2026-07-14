# 23 Incident Response Runbook

## Incident Types

- Security incident.
- Payment incident.
- Data loss incident.
- Availability incident.
- Sync corruption.
- AI privacy incident.
- Notification failure.

## Severity

### SEV-1

Cross-tenant data exposure, data loss, payment corruption, or total production outage.

### SEV-2

Major workflow broken for many schools.

### SEV-3

Localized issue with workaround.

## First 15 Minutes

1. Assign incident commander.
2. Confirm impact.
3. Freeze risky deploys.
4. Start timeline.
5. Preserve logs and evidence.
6. Communicate internally.

## Response Principles

- Stop the bleeding first.
- Preserve data.
- Communicate clearly.
- Do not hide payment or privacy impact.
- Write postmortem.

## Postmortem

Include:

- timeline.
- root cause.
- impact.
- detection gap.
- response gap.
- permanent fixes.
- owner and due date.

## Special Cases

Payment corruption requires reconciliation freeze and finance review.

Cross-tenant exposure requires security lead review, access log preservation, and customer communication plan.

