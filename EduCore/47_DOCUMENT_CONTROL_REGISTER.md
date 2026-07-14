# 47 Document Control Register

## Purpose

This is the human-readable control register for the EduCore documentation system. `DOCUMENT_MANIFEST.json` is the machine-readable companion for AI tools and automation.

## Document States

- **Constitutional:** highest-level enduring rule.
- **Accepted:** active decision or approved standard.
- **Frozen:** change-controlled baseline; material change needs ADR/re-freeze.
- **Active:** current operational or execution guide.
- **Template:** reusable working artifact.
- **Historical:** retained context; not the canonical current implementation instruction.

## Canonical Control Map

| Need | Canonical Document | State | Review Trigger |
|---|---|---|---|
| First onboarding | `00_START_HERE.md` | Active | Any status or authority change |
| Current phase and permission | `43_PROJECT_STATUS.md` | Active | Freeze, blocker, sprint, or pilot change |
| Highest engineering rules | `03_DEVELOPMENT_CONSTITUTION.md` | Constitutional | Material delivery/governance change |
| Architecture baseline | `35_PROJECT_ARCHITECTURE.md` and `38_ARCHITECTURE_FREEZE_RECORD.md` | Frozen | ADR/re-freeze |
| Product implementation requirements | `34_SOFTWARE_REQUIREMENTS_SPECIFICATION.md` | Frozen | Approved requirement change |
| Architecture decisions | `decisions/ADR-*.md` | Accepted | New material decision |
| Current execution sequence | `39_ENGINEERING_EXECUTION_ROADMAP.md` | Active | Milestone/workstream change |
| Implementation behavior | `40_MASTER_ENGINEERING_EXECUTION_PROMPT.md` and `41_AI_ENGINEERING_OPERATING_SYSTEM.md` | Active | Process/control change |
| Implementation permission | `42_ENGINEERING_READINESS_REVIEW.md` | Active | Re-review evidence available |
| Task entry gate | `44_DEFINITION_OF_READY.md` | Active | Delivery-control change |
| Deferred decisions | `46_KNOWN_LIMITATIONS.md` | Active | Decision/freeze changes |
| Documentation change history | `CHANGELOG.md` | Active | Material documentation update |

## Metadata Standard For New Documents

Every new enduring document must contain:

- Stable file name and title.
- Purpose and scope.
- Status/authority where relevant.
- Related canonical documents and ADRs.
- Owner role and review trigger when it governs an ongoing process.
- Explicit statement of what it does not decide when ambiguity is possible.

Do not add a new document when an existing canonical document can be updated without reducing clarity.