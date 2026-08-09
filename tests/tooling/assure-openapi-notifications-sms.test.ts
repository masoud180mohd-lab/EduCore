import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const openApiPath = path.join(
  projectRoot,
  'docs/engineering/api-contract-freeze/openapi/acf-014-notifications-sms.openapi.yaml',
);

function loadDoc(): {
  paths?: Record<
    string,
    Record<
      string,
      {
        'x-authz'?: { stack?: string[]; permissionCodes?: string[] };
      }
    >
  >;
} {
  return load(readFileSync(openApiPath, 'utf8')) as ReturnType<typeof loadDoc>;
}

function permissionCodes(pathKey: string, method: string): string[] {
  return loadDoc().paths?.[pathKey]?.[method]?.['x-authz']?.permissionCodes ?? [];
}

function authzStack(pathKey: string, method: string): string[] {
  return loadDoc().paths?.[pathKey]?.[method]?.['x-authz']?.stack ?? [];
}

describe('ASSURE OpenAPI notifications/SMS (ACF-014)', () => {
  it('loads ACF-014 OpenAPI document', () => {
    expect(loadDoc().paths).toBeTypeOf('object');
  });

  it('covers product notification paths with session_tenant_bind', () => {
    const paths = Object.keys(loadDoc().paths ?? {});
    for (const p of [
      '/notification-templates',
      '/notifications/requests',
      '/notifications/requests/{requestId}',
      '/notifications/deliveries',
      '/notifications/usage',
    ]) {
      expect(paths, `missing ${p}`).toContain(p);
    }
    expect(permissionCodes('/notification-templates', 'get')).toContain('notification.read');
    expect(permissionCodes('/notifications/requests', 'post')).toContain('notification.manage');
    expect(authzStack('/notifications/deliveries', 'get')).toContain('session_tenant_bind');
  });

  it('documents Beem webhook as shared-secret (no session)', () => {
    expect(Object.keys(loadDoc().paths ?? {})).toContain('/notifications/webhooks/beem');
    expect(authzStack('/notifications/webhooks/beem', 'post')).toContain('shared_secret');
    expect(permissionCodes('/notifications/webhooks/beem', 'post')).toEqual([]);
  });
});
