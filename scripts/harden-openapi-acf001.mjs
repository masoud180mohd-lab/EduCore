import { readFileSync, writeFileSync } from 'node:fs';
import { load, dump } from 'js-yaml';

const path = 'docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml';
const doc = load(readFileSync(path, 'utf8'));

doc.info.description = [
  'API Contract Freeze ACF-001 for Identity And Access + Tenant And Billing (baseline).',
  'Status: CONDITIONAL acceptance — design baseline under IMP-001; not a full v1.0 production freeze signature.',
  'Domain HTTP routes are not implemented yet; this document governs future implementation.',
  'AuthZ stack: Authenticated → Active membership → Permission code → Scope → RLS.',
  'Operation extensions: x-permissions (codes), x-authz (stack summary).',
].join(' ');

doc.components = doc.components || {};
doc.components.securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'Access token from /auth/login or /auth/refresh. Format flexible until IdP ADR. Missing/invalid → 401 UNAUTHORIZED.',
  },
  tenantHeader: {
    type: 'apiKey',
    in: 'header',
    name: 'X-Tenant-Id',
    description:
      'Active tenant UUID. Required on tenant-scoped routes. Must match an active membership for the caller (or trusted platform path). Missing/invalid → 400 TENANT_CONTEXT_REQUIRED or 403 TENANT_MEMBERSHIP_REQUIRED.',
  },
};

doc.security = [{ bearerAuth: [] }];

const permissionByOperation = {
  authLogin: [],
  authMfaVerify: [],
  authRefresh: [],
  authLogout: [],
  authMe: [],
  authSelectTenant: ['tenant.read'],
  listSessions: ['session.revoke'],
  revokeSession: ['session.revoke'],
  createTenant: ['tenant.manage'],
  getCurrentTenant: ['tenant.read'],
  getTenant: ['tenant.read'],
  updateTenant: ['tenant.manage'],
  listOrganizations: ['organization.read'],
  createOrganization: ['organization.manage'],
  getOrganization: ['organization.read'],
  updateOrganization: ['organization.manage'],
  deactivateOrganization: ['organization.manage'],
  getTenantSettings: ['tenant.read'],
  putTenantSettings: ['tenant.manage'],
  listEntitlements: ['entitlement.read'],
  getCurrentSubscription: ['tenant.read'],
  listUsers: ['user.read'],
  getUser: ['user.read'],
  updateUser: ['user.manage'],
  disableUser: ['user.manage'],
  listMemberships: ['user.read'],
  createMembership: ['user.invite'],
  getMembership: ['user.read'],
  suspendMembership: ['user.manage'],
  reactivateMembership: ['user.manage'],
  removeMembership: ['user.manage'],
  listPermissions: ['role.read'],
  listRoles: ['role.read'],
  createRole: ['role.manage'],
  getRole: ['role.read'],
  updateRole: ['role.manage'],
  replaceRolePermissions: ['role.manage'],
  listUserRoles: ['role.read'],
  assignUserRole: ['role.manage'],
  unassignUserRole: ['role.manage'],
  listMyMfaFactors: [],
  beginMfaEnrollment: [],
  confirmMfaEnrollment: [],
  disableMfaFactor: [],
  listRelationships: ['user.read'],
  createRelationship: ['user.manage'],
  endRelationship: ['user.manage'],
  listDelegations: ['user.manage'],
  createDelegation: ['user.manage'],
  revokeDelegation: ['user.manage'],
};

const publicOps = new Set(['authLogin', 'authMfaVerify', 'authRefresh']);
const bearerOnly = new Set([
  'authLogout',
  'authMe',
  'listMyMfaFactors',
  'beginMfaEnrollment',
  'confirmMfaEnrollment',
  'disableMfaFactor',
  'createTenant',
]);

for (const pathItem of Object.values(doc.paths || {})) {
  for (const method of Object.keys(pathItem)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
    const op = pathItem[method];
    if (!op || typeof op !== 'object') continue;
    const id = op.operationId;
    if (!id || !(id in permissionByOperation)) continue;

    if (publicOps.has(id)) {
      op.security = [];
    } else if (bearerOnly.has(id)) {
      op.security = [{ bearerAuth: [] }];
    } else {
      op.security = [{ bearerAuth: [], tenantHeader: [] }];
    }

    const perms = permissionByOperation[id];
    op['x-permissions'] = perms;
    op['x-authz'] = {
      stack: [
        publicOps.has(id) ? 'public' : 'authenticated',
        !publicOps.has(id) && !bearerOnly.has(id) ? 'active_membership' : null,
        perms.length > 0 ? 'permission_codes' : null,
        'scope',
        'rls',
      ].filter(Boolean),
      permissionCodes: perms,
      notes:
        perms.length === 0
          ? 'No catalogue permission required (public or self-service). Membership still applies where stack lists active_membership.'
          : 'Requires listed permission codes unless a documented self-service exception applies.',
    };

    op.responses = op.responses || {};
    if (!publicOps.has(id)) {
      if (!op.responses['401']) {
        op.responses['401'] = { $ref: '#/components/responses/Unauthorized' };
      }
      if (!bearerOnly.has(id) && !op.responses['403']) {
        op.responses['403'] = { $ref: '#/components/responses/Forbidden' };
      }
    }
  }
}

doc.components['x-permission-catalogue'] = {
  description: 'DBF-001 / ACF-001 first-slice permission codes (seeded in DB)',
  codes: [
    'tenant.read',
    'tenant.manage',
    'organization.read',
    'organization.manage',
    'user.invite',
    'user.read',
    'user.manage',
    'role.read',
    'role.manage',
    'session.revoke',
    'audit.read',
    'entitlement.read',
    'entitlement.manage',
  ],
};

writeFileSync(
  path,
  dump(doc, {
    lineWidth: 120,
    noRefs: true,
    sortingKeys: false,
  }),
  'utf8',
);

process.stdout.write(`OpenAPI hardened: ${path}\n`);
