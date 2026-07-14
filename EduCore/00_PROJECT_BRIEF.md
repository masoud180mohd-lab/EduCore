# 00 Project Brief

## Project Name

Working names:

- EdusNexus
- EduNexus Africa
- EduCore

For development documentation, use `EduCore` as the internal platform name.

## One-Line Description

EduCore is a cloud-native, AI-ready, offline-capable, multi-tenant education operations platform for schools in Africa, starting with Tanzania and expanding across regional markets.

## The Real Problem

Most school management systems fail in African operating conditions:

- They assume stable internet.
- They do not deeply support mobile money.
- They have weak parent engagement.
- They rely on old UI patterns.
- They lack strong tenant isolation.
- They have shallow or unsafe AI.
- They treat finance as fee records, not accounting.
- They lack reliable offline workflows.
- They are difficult to deploy, support, and customize.

EduCore must solve the daily operational pain of schools while building long-term platform leverage.

## Target Users

Primary users:

- School Owner
- Headmaster
- Deputy Headmaster
- Academic Master
- Registrar
- Accountant
- Bursar
- Secretary
- Class Teacher
- Subject Teacher
- Student
- Parent

Secondary users:

- Librarian
- Store Keeper
- Hostel Master
- Transport Manager
- Nurse
- Discipline Officer
- Security Staff
- Visitor
- Government Education Officer
- Platform Support
- Super Admin

## Business Goal

Build a commercially viable SaaS platform that can serve thousands of schools and millions of students with strong reliability, data protection, and recurring revenue.

Revenue streams:

- Subscription plans.
- Per-student pricing.
- SMS/WhatsApp metered usage.
- Payment processing margin where legally and commercially viable.
- Premium AI features.
- Enterprise white-label contracts.
- Future verification and ecosystem APIs.

## Non-Negotiable Constraints

- Must work in weak internet environments.
- Must support mobile-first usage.
- Must support Kiswahili and English from early phases.
- Must support mobile money and bank reconciliation.
- Must protect child data aggressively.
- Must enforce tenant isolation at application and database level.
- Must not let AI make high-stakes decisions without human review.
- Must treat finance as an accounting system, not only a payment log.
- Must be modular enough to become microservices later, but must not start as distributed chaos.

## Initial Technology Direction

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

Mobile:

- React Native
- Expo
- SQLite / WatermelonDB where offline sync is required

Backend:

- NestJS
- TypeScript
- Modular monolith

AI:

- FastAPI AI service behind an AI Gateway
- External LLM APIs first
- Local or fine-tuned models later only when justified

Database:

- PostgreSQL
- Row-Level Security
- Shared multi-tenant model by default

Infrastructure:

- Docker for packaging
- Simple reproducible production deployment first
- Kubernetes only after operational need is proven

## Current Architecture Verdict

The current direction is strong but must be hardened before implementation. The most important required corrections are:

- Narrow MVP scope.
- Simplify tenancy to one default model.
- Strengthen authorization beyond simple RBAC.
- Make ledger the finance source of truth.
- Redesign offline sync around operations, not last-write-wins.
- Add AI governance before AI feature expansion.
- Add workflow-level observability.
- Define disaster recovery and restore drills.
- Classify private data and design audit trails safely.

