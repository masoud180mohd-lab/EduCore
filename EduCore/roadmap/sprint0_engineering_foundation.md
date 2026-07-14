# Sprint 0: Engineering Foundation

## Purpose

Build the reusable delivery foundation for EduCore. This sprint creates no business feature, student workflow, payment workflow, or production domain API.

Architecture Freeze v1.0 is already complete. The Database, API Contract, and Design System freeze gates remain prerequisites for production feature slices. Sprint 0 may implement neutral platform tooling and skeletons that do not invent those contracts.

## Goals

- Establish a secure, repeatable local and CI development path.
- Make the architecture, coding standards, testing standards, and operational rules enforceable.
- Build shared technical primitives without embedding business domain behavior.
- Prove that a future feature team can safely create, test, observe, and release a small slice.

## Workstreams And Exit Criteria

| Workstream | Scope | Exit evidence |
|---|---|---|
| Repository and workspace | Monorepo structure, workspace boundaries, package ownership, contribution guide | Clean bootstrap from a new machine; boundary check documented |
| Code quality | Strict TypeScript, linting, formatting, import rules, commit convention, Git hooks | CI blocks formatting, lint, type, and boundary failures |
| Environment and secrets | Environment schema, local example values, secret provider interface, configuration validation | No secret in repository; invalid/missing configuration fails safely |
| Local platform | Docker development environment for approved local dependencies and documented commands | One documented local startup path works from a clean checkout |
| CI/CD baseline | Pull request validation, artifact policy, environment promotion, rollback placeholder | Required checks run automatically and branch protections are documented |
| Test foundation | Unit, integration, contract-test harnesses; test data isolation; coverage reporting | A sample neutral package proves all test layers run in CI |
| Logging and errors | Typed error taxonomy, request/correlation IDs, redaction policy, structured logging | Error and log tests prove no secret/PII leakage in sample paths |
| Configuration and flags | Typed configuration service and feature-flag abstraction with ownership/expiry metadata | Flag lifecycle and default-off behavior tested |
| Health and observability | Liveness/readiness checks, metrics/tracing interfaces, dashboard/alert templates | Health endpoints and a traceable sample request demonstrated |
| Identity skeleton | Interface boundaries for authentication/session/MFA integration; no unapproved user schema | Deny-by-default route guard demonstrated using fixtures only |
| Authorization skeleton | Policy engine interface, request actor/context model, audit hook interface | Deny-by-default policy tests and audit hook tests pass |
| Tenant foundation | Tenant context propagation and repository guard abstraction; no RLS claim before DB freeze | Cross-tenant access attempt fails in a neutral test harness |
| API foundation | Versioning policy, error envelope, correlation/idempotency interfaces, OpenAPI tooling | No business route; contract tooling validates a neutral health/meta endpoint only |
| Data tooling | Migration runner and seed framework interfaces, migration naming rules, backup/restore test plan | Empty baseline migration flow works; no business schema is created before DB freeze |
| Design foundation | Token pipeline, accessibility baseline, shared layout and status primitives | Tokens build and sample neutral components meet baseline checks |
| Documentation portal | Kit navigation, architecture/ADR links, developer onboarding, runbook templates | New contributor can find all controls in one location |

## Explicit Non-Goals

- No student, admission, class, attendance, mark, finance, payment, library, hostel, transport, notification, report, or AI business capability.
- No final tenant RLS policy or business table before Database Freeze.
- No public business API before API Contract Freeze.
- No role-specific production screen before Design System Freeze.
- No authentication provider, cloud provider, or new core technology selected without an ADR where the kit requires one.

## Suggested Delivery Order

1. Repository/workspace, standards enforcement, and documentation portal.
2. Environment, configuration, secrets, Docker, and CI baseline.
3. Test, logging, errors, feature flags, health, and observability foundations.
4. Identity, authorization, and tenant context skeletons with neutral test fixtures.
5. API versioning and database migration/seed tooling.
6. Design tokens and accessibility primitives.
7. Sprint 0 integration demonstration and readiness review.

## Quality Gates

- Clean checkout can bootstrap using documented commands.
- No committed secret, permissive default authorization, or tenant context bypass.
- CI runs format, lint, type, tests, dependency/security checks, and documentation link checks.
- A neutral request emits a correlation ID, structured redacted log, trace/metric hook, and typed error response.
- All abstractions have ownership and an intentionally small public surface.
- No work item leaks business-domain behavior into shared packages.

## Sprint 0 Exit Checklist

- [ ] Repository and workspace baseline accepted.
- [ ] Coding standards enforcement is active locally and in CI.
- [ ] Local environment and secret-management approach documented and tested.
- [ ] Docker and CI/CD baseline operational.
- [ ] Testing, logging, errors, configuration, feature flags, health checks, and observability foundations operational.
- [ ] Tenant, authentication, and authorization skeletons deny by default and are tested.
- [ ] API versioning and migration/seed frameworks work without prematurely defining business contracts.
- [ ] Design tokens and accessibility baseline are usable.
- [ ] Documentation portal/onboarding path is complete.
- [ ] Sprint 0 review confirms no business features were added.

## Handoff To Sprint 1

Sprint 1 feature work begins only for the approved identity and organization slice after its Database, API Contract, and Design System freeze evidence is accepted. The first feature-slice scope is Identity, Authentication, Users, Organizations, Schools, and RBAC.