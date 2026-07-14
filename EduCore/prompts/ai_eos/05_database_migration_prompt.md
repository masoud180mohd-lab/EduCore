# AI-EOS Database And Migration Prompt

```text
Use only after Database Freeze for the affected slice. Review the approved schema and propose a reversible expand-contract migration plan. Include ownership, tenant/RLS implications, indexes, backfill, locking/performance risk, seed data, validation, rollback, and tenant-isolation tests. Follow ledger, offline, and audit rules where applicable. Do not invent a schema that is not frozen.
```