# 32 Access Control Bible

## Access Model

EduCore uses layered access control:

1. Authentication.
2. Tenant membership.
3. RBAC role.
4. Relationship-based access.
5. ABAC context.
6. RLS final enforcement.

## Relationship Examples

- Parent to child.
- Teacher to assigned subject.
- Class teacher to class.
- Academic master to stream.
- Headmaster to school.
- Platform support to approved support session.

## Explicit Deny

Some actions must be denied even if role seems broad:

- user approving own sensitive finance request.
- support accessing health records without approved reason.
- teacher editing approved marks after lock.
- parent accessing another child.
- approver approving marks they themselves submitted as a teacher (AMEND-2026-08-15; reachable when Head/Deputy also teach).
- platform operator reading or writing tenant-internal data outside an approved, time-bound support session (platform capability grants tenant *lifecycle* control, never implicit tenant data access).

## Delegation

Delegations must include:

- delegator.
- delegatee.
- scope.
- permissions.
- expiry.
- reason.
- audit trail.

## Access Review

School owners and platform admins should periodically review:

- privileged users.
- finance roles.
- support sessions.
- government officer access.
- inactive users.

## Testing

Maintain golden permission tests for every major role and relationship.

