# 16 Security Standards

## Security Principles

- Deny by default.
- Least privilege.
- Defense in depth.
- Tenant isolation at every layer.
- Secure by default configuration.
- Audit sensitive actions.
- Assume credentials will leak.

## Authentication

Preferred approach:

- OIDC-compatible identity provider.
- MFA for privileged roles.
- Session revocation.
- Device visibility.
- Strong password policy if passwords are used.

## Authorization

Authorization must check:

- user identity.
- tenant membership.
- role.
- relationship scope.
- contextual attributes.
- explicit deny rules.

## Tenant Isolation

Required:

- application guard.
- RLS.
- tenant-scoped cache keys.
- tenant-scoped search filters.
- tenant-scoped object paths.
- tenant isolation tests.

## Secrets

Secrets must be stored only in approved secret management systems. Never commit secrets to source control.

## Sensitive Data

Never log:

- passwords.
- tokens.
- OTPs.
- full child-sensitive records.
- raw payment secrets.
- private health notes.

## Security Testing

Required:

- dependency scanning.
- SAST.
- DAST for web.
- tenant isolation tests.
- permission matrix tests.
- webhook signature tests.
- penetration testing before public launch.

## Incident Severity

Critical security incidents include:

- cross-tenant data exposure.
- payment credential exposure.
- child data breach.
- admin account takeover.
- unrecoverable data loss.

