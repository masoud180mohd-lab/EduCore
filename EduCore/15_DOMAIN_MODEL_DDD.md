# 15 Domain Model And DDD Bible

## Purpose

This document defines the language and boundaries of EduCore. All AI agents and developers must use this vocabulary.

## Core Domains

### School Operations

The school daily operating layer: students, classes, attendance, exams, staff activity, and communication.

### School Finance

Invoices, payments, receipts, ledger, reconciliation, discounts, scholarships, refunds, and reports.

### Education Intelligence

Analytics, AI insights, predictions, summaries, and decision support.

## Bounded Contexts

- Identity and Access.
- Tenant and Billing.
- Student Registry.
- Academic Structure.
- Attendance.
- Assessment.
- Finance Ledger.
- Payments.
- Communication.
- Documents and Files.
- AI Insights.
- Integrations.
- Analytics.
- Platform Operations.

## Ubiquitous Language

- Tenant: a school or school group using the platform.
- Student: learner registered under a tenant.
- Guardian: parent or responsible adult linked to a student.
- Enrollment: student assignment to academic year, class, stream, and status.
- Attendance Session: a class/day/period capture event.
- Mark: score for a student in an exam subject.
- Approval: official acceptance of marks, expenses, or sensitive workflow.
- Invoice: amount owed by student or guardian.
- Payment Attempt: request to pay through a provider.
- Receipt: confirmation document after accepted payment.
- Journal Entry: immutable accounting event.
- Notification Request: intent to send a message.
- Delivery: provider-level send result.
- Offline Operation: client-created mutation waiting for server acceptance.

## Aggregate Rules

- Student Registry owns student identity.
- Academic Structure owns class and subject assignments.
- Attendance owns attendance records.
- Assessment owns marks and approvals.
- Finance Ledger owns balances.
- Payments owns gateway events, not balances.
- Communication owns delivery state, not business events.

## Anti-Corruption Rules

External provider payloads must never become internal domain models. Use adapters for payments, SMS, WhatsApp, email, AI, and government systems.

