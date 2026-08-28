# EduCore Kit Index

## Root Documents

| File | Purpose |
|---|---|
| `VERSION.md` | Version and status of the kit |
| `00_START_HERE.md` | Mandatory onboarding and execution gate |
| `00_PROJECT_BRIEF.md` | Project baseline |
| `01_PRODUCT_VISION.md` | Long-term product direction |
| `02_PRODUCT_REQUIREMENTS.md` | MVP and product requirements |
| `03_DEVELOPMENT_CONSTITUTION.md` | Highest-level development rules |
| `04_SYSTEM_ARCHITECTURE.md` | System architecture |
| `05_DATABASE_DESIGN.md` | Database standards |
| `06_API_SPECIFICATION.md` | API standards |
| `07_DESIGN_SYSTEM.md` | UX and design rules |
| `08_BACKEND_GUIDELINES.md` | Backend implementation rules |
| `09_FRONTEND_GUIDELINES.md` | Frontend implementation rules |
| `10_AI_GUIDELINES.md` | AI governance rules |
| `11_TESTING_GUIDELINES.md` | Testing strategy |
| `12_DEPLOYMENT_GUIDELINES.md` | Deployment and operations |
| `13_PROJECT_CHARTER.md` | Project mandate |
| `14_BUSINESS_MODEL.md` | SaaS business model |
| `15_DOMAIN_MODEL_DDD.md` | DDD and domain language |
| `16_SECURITY_STANDARDS.md` | Security standards |
| `17_PRIVACY_DATA_GOVERNANCE.md` | Privacy and data governance |
| `18_CODING_STANDARDS.md` | Coding rules |
| `19_GIT_WORKFLOW.md` | Git and PR workflow |
| `20_PAYMENT_ACCOUNTING_BIBLE.md` | Payment and ledger rules |
| `21_OFFLINE_SYNC_BIBLE.md` | Offline sync rules |
| `22_OBSERVABILITY_BIBLE.md` | Observability standards |
| `23_INCIDENT_RESPONSE_RUNBOOK.md` | Incident response |
| `24_RELEASE_MANAGEMENT.md` | Release safety |
| `25_RISK_REGISTER.md` | Risk register |
| `26_GLOSSARY.md` | Shared vocabulary |
| `27_INTEGRATION_STANDARDS.md` | External integration rules |
| `28_SUPPORT_OPERATIONS.md` | Support operations |
| `29_COMPLIANCE_CHECKLIST.md` | Compliance readiness |
| `30_PRODUCT_ANALYTICS_METRICS.md` | Product and business metrics |
| `31_DATA_RETENTION_POLICY.md` | Retention and deletion |
| `32_ACCESS_CONTROL_BIBLE.md` | Authorization bible |
| `33_SRE_RUNBOOKS.md` | SRE runbook standards |
| `34_SOFTWARE_REQUIREMENTS_SPECIFICATION.md` | Explicit consolidated SRS |
| `35_PROJECT_ARCHITECTURE.md` | Explicit consolidated project architecture |
| `36_ARCHITECTURE_VALIDATION_SPRINT.md` | Sprint 0 validation plan |
| `37_FINAL_ARCHITECTURE_REVIEW.md` | Final architecture review and gap resolution |
| `38_ARCHITECTURE_FREEZE_RECORD.md` | Architecture Freeze v1.0 |
| `39_ENGINEERING_EXECUTION_ROADMAP.md` | Execution plan from freeze gates to GA |
| `40_MASTER_ENGINEERING_EXECUTION_PROMPT.md` | Mandatory AI implementation control prompt |
| `41_AI_ENGINEERING_OPERATING_SYSTEM.md` | AI-EOS workflow, prompts, quality bar, and escalation |
| `42_ENGINEERING_READINESS_REVIEW.md` | Historical readiness checklist (Board wrapper retired, SOLO-GOV-002) |
| `43_PROJECT_STATUS.md` | Canonical current phase, permissions, and next milestone |
| `44_DEFINITION_OF_READY.md` | Mandatory task readiness criteria |
| `45_TECHNICAL_DEBT_POLICY.md` | Technical debt governance |
| `46_KNOWN_LIMITATIONS.md` | Deferred decisions and implementation limits |
| `47_DOCUMENT_CONTROL_REGISTER.md` | Canonical documentation control map |
| `48_AI_DEVELOPMENT_KIT_AUDIT_AND_ENHANCEMENT.md` | Kit audit and enhancement report (historical) |
| `CHANGELOG.md` | Material documentation history |
| `DOCUMENT_MANIFEST.json` | Machine-readable kit metadata and authority map |

## Folders

| Folder | Purpose |
|---|---|
| `decisions/` | Architecture Decision Records |
| `prompts/` | AI task prompts |
| `prompts/ai_eos/` | SDLC-specific AI-EOS prompts |
| `roadmap/` | Phased product roadmap |
| `templates/` | Reusable templates |

## Sprint Sequence

| Sprint | File | Purpose |
|---|---|---|
| Sprint 0 | `roadmap/sprint0_planning_validation.md` | Architecture validation and freeze |
| Sprint 1 | `roadmap/sprint1_database_design_freeze.md` | Database schema, ERD, migration strategy freeze |
| Sprint 2 | `roadmap/sprint2_backend_foundation.md` | Backend foundation after database freeze |
| Sprint 3 | `roadmap/sprint3_frontend_foundation.md` | Frontend foundation after design freeze |
| Engineering Sprint 0 | `roadmap/sprint0_engineering_foundation.md` | Non-business delivery foundation after freeze gates |

## Recommended AI Start Prompt

Use this when starting a new AI session:

```text
You are working on EduCore. Before doing anything, read 00_START_HERE.md, README.md, VERSION.md, 43_PROJECT_STATUS.md, 03_DEVELOPMENT_CONSTITUTION.md, 34_SOFTWARE_REQUIREMENTS_SPECIFICATION.md, 35_PROJECT_ARCHITECTURE.md, 36_ARCHITECTURE_VALIDATION_SPRINT.md, 37_FINAL_ARCHITECTURE_REVIEW.md, 38_ARCHITECTURE_FREEZE_RECORD.md, 39_ENGINEERING_EXECUTION_ROADMAP.md, 40_MASTER_ENGINEERING_EXECUTION_PROMPT.md, 41_AI_ENGINEERING_OPERATING_SYSTEM.md, 42_ENGINEERING_READINESS_REVIEW.md, 44_DEFINITION_OF_READY.md, 46_KNOWN_LIMITATIONS.md, relevant ADRs in decisions/, slice freezes under docs/engineering/, and the relevant domain bible. Follow the authority order in README.md. Do not bypass tenant isolation, ledger rules, offline sync rules, AI Gateway, privacy, audit, or observability requirements. Operating model is Owner + AI (SOLO-GOV-002). Do not wait for an Independent Board. Gated IMP work is allowed behind Owner-accepted slice freezes. Do not invent ClickPesa credentials. Prefer 43_PROJECT_STATUS.md over stale chat memory.
```
