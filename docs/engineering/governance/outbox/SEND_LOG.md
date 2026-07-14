# ADR-012 Countersignature Outbox — Send Log & Human Checklist

| Field                      | Value                                                                  |
| -------------------------- | ---------------------------------------------------------------------- |
| Packet prepared            | **2026-07-15**                                                         |
| Recommended send date      | **2026-07-16** (latest **2026-07-17**)                                 |
| Prepared by                | Principal Architect / Governance Lead (governance packaging session)   |
| AI transmission capability | **None** — no org mailbox / SMTP in this environment. Human must send. |

---

## 1. What has been prepared (ready files)

| #   | File                                                                  | Purpose                                                 |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | `2026-07-15-email-pm-master-database-architect.md`                    | Personalized email → **PM Master** (Database Architect) |
| 2   | `2026-07-15-email-masoud-salum-security-lead.md`                      | Personalized email → **Masoud Salum** (Security Lead)   |
| 3   | `2026-07-15-email-rashid-mohammed-backend-lead.md`                    | Personalized email → **Rashid Mohammed** (Backend Lead) |
| 4   | `2026-08-13-adr-012-review-meeting.ics`                               | Calendar invite — **13 Aug 2026, 10:00–11:15 EAT**      |
| 5   | `../ADR-012_ONE_PAGE_SUMMARY.md`                                      | Attach / link (1-page pre-read)                         |
| 6   | `../ADR-012_COUNTERSIGNATURE_PACKET.md`                               | Attach / link (full packet index)                       |
| 7   | `../IDENTITY_TENANT_GOVERNANCE_ACTION_PLAN.md`                        | Background (linked from emails)                         |
| 8   | `../../decisions/ADR-012-exception-identity-tenant-implementation.md` | Document to countersign                                 |

### Transmission status

| Channel                 | Status                                                               |
| ----------------------- | -------------------------------------------------------------------- |
| Email → PM Master       | **READY — not sent**                                                 |
| Email → Masoud Salum    | **READY — not sent**                                                 |
| Email → Rashid Mohammed | **READY — not sent**                                                 |
| Calendar (.ics)         | **READY — not sent** (replace placeholder emails + video link first) |

---

## 2. Deadlines (do not change without updating ADR-012)

| Milestone                     | Date                            |
| ----------------------------- | ------------------------------- |
| **Send emails + calendar**    | 2026-07-16 (latest 2026-07-17)  |
| Soft reminder                 | 2026-07-30                      |
| Final reminder                | 2026-08-05                      |
| **Countersignature deadline** | **2026-08-08**                  |
| **Review meeting**            | **2026-08-13, 10:00–11:15 EAT** |
| Alternate meeting             | 2026-08-12, 14:00–15:15 EAT     |
| Binding ADR review-by         | 2026-08-15                      |
| ADR hard expiry               | 2026-09-15                      |

---

## 3. HUMAN-ONLY checklist (AI cannot do these)

Complete in order. Tick when done.

### Before send (setup)

- [ ] Collect **real email addresses** for:
  - [ ] PM Master (Database Architect)
  - [ ] Masoud Salum (Security Lead)
  - [ ] Rashid Mohammed (Backend Lead)
  - [ ] Principal Architect / Governance Lead (From + Organizer)
- [ ] Create / copy **video meeting link** (Teams / Google Meet / Zoom)
- [ ] Open `2026-08-13-adr-012-review-meeting.ics` in a text editor and replace:
  - [ ] `architect@example.invalid`
  - [ ] `pm.master@example.invalid`
  - [ ] `masoud.salum@example.invalid`
  - [ ] `rashid.mohammed@example.invalid`
  - [ ] `LOCATION:Video conference — REPLACE WITH REAL LINK...` → real URL
- [ ] Optional: import `.ics` into Outlook/Google Calendar and invite the three (often more reliable than raw ICS attach)

### Send emails (≈ 15–20 minutes)

For **each** of the three email files:

1. Open the `.md` file in the outbox folder.
2. Copy the **SUBJECT** block into a new message.
3. Copy the **BODY** block (inside the triple-backtick section) into the message.
4. Set **To** / **Cc** to real addresses (Cc the other two countersigners).
5. **Attach** (recommended):
   - `ADR-012_ONE_PAGE_SUMMARY.md` (or PDF export if preferred)
   - `ADR-012_COUNTERSIGNATURE_PACKET.md`
   - `2026-08-13-adr-012-review-meeting.ics` (if not already invited via calendar app)
   - For Masoud only: also attach / link `AUDIT-R2-live-evidence-2026-07-14.md`
6. Send.
7. Tick below:

- [ ] Sent → **PM Master**
- [ ] Sent → **Masoud Salum**
- [ ] Sent → **Rashid Mohammed**
- [ ] Calendar invite delivered to all three + you
- [ ] Video link present in invite
- [ ] No `example.invalid` addresses remain in the sent invite

### After send

- [ ] Save Sent copies (or BCC yourself)
- [ ] Update this log’s “Sent confirmation” timestamps if desired
- [ ] Calendar reminder: soft chase **2026-07-30**
- [ ] Calendar reminder: final chase **2026-08-05**
- [ ] After each APPROVE reply: update Approval table in `ADR-012-exception-identity-tenant-implementation.md`
- [ ] Before meeting: confirm all three countersignatures or document CHANGES REQUESTED

---

## 4. How to send (copy-paste recipe)

### Option A — Gmail / Outlook web (simplest)

1. New email → paste Subject + Body from each outbox file.
2. Attach the governance files from `docs/engineering/governance/`.
3. Attach the `.ics` **or** create the same meeting in Google Calendar / Outlook and add attendees.
4. Send on **2026-07-16**.

### Option B — Outlook desktop

1. File → Open → the `.ics` (or double-click) → edit attendees & location → Send.
2. Forward or create three separate emails using the outbox bodies.
3. Attach packet docs from the repo checkout.

### Option C — Shared monorepo only (no attachments)

If all four people already have the repo:

1. Email body only (paths already listed).
2. Still send `.ics` or native calendar invite.
3. Tell recipients: “All paths are relative to the EduCore repository root.”

---

## 5. Sent confirmation (fill when done)

| Recipient       | Role               | Sent date/time | Method (Gmail/Outlook/…) | Notes |
| --------------- | ------------------ | -------------- | ------------------------ | ----- |
| PM Master       | Database Architect |                |                          |       |
| Masoud Salum    | Security Lead      |                |                          |       |
| Rashid Mohammed | Backend Lead       |                |                          |       |
| Calendar        | All + Host         |                |                          |       |

---

## 6. What AI prepared vs what only a human can do

| Prepared by AI (done)                 | Must be done by a human                    |
| ------------------------------------- | ------------------------------------------ |
| Three personalized email templates    | Replace placeholder emails                 |
| Professional subjects + bodies        | Actually click **Send**                    |
| ICS with agenda + attendees structure | Set real video link                        |
| Deadlines aligned to ADR-012          | Chase non-responders                       |
| This SEND_LOG checklist               | Update ADR-012 Approval rows after APPROVE |
| Packet document index                 | Collect countersignature replies           |

---

## 7. Quick “I’m in a hurry” path (15 minutes)

1. Get 3 emails + your From address + Meet link.
2. Fix `.ics` placeholders.
3. Create one calendar event 13 Aug 10:00 EAT → invite all three.
4. Send three emails (copy body from outbox) with links to repo paths.
5. Tick the three “Sent” boxes above.

**Do not delay past 2026-07-17** — countersign window to 2026-08-08 is intentional but short.
