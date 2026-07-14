import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const openApiPath = path.join(
  projectRoot,
  'docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml',
);

type OpenApiDocument = {
  openapi?: unknown;
  paths?: Record<string, unknown>;
  components?: {
    schemas?: Record<string, unknown>;
  };
};

function loadOpenApi(): OpenApiDocument {
  const raw = readFileSync(openApiPath, 'utf8');
  return load(raw) as OpenApiDocument;
}

/**
 * Minimal structural validation for ErrorEnvelope (ACF-001).
 * Full AJV/OpenAPI response validation expands in later tasks.
 */
function assertErrorEnvelope(body: unknown): void {
  expect(body).toBeTypeOf('object');
  expect(body).not.toBeNull();
  const root = body as Record<string, unknown>;
  expect(root).toHaveProperty('error');

  const error = root['error'];
  expect(error).toBeTypeOf('object');
  expect(error).not.toBeNull();
  const err = error as Record<string, unknown>;

  expect(typeof err['code']).toBe('string');
  expect(String(err['code']).length).toBeGreaterThan(0);
  expect(typeof err['message']).toBe('string');
  expect(typeof err['requestId']).toBe('string');
  expect(String(err['requestId']).length).toBeGreaterThan(0);

  // Security: never allow stack/sql fields in the public envelope.
  expect(err).not.toHaveProperty('stack');
  expect(err).not.toHaveProperty('sql');
  expect(JSON.stringify(err).toLowerCase()).not.toMatch(/password|pg_password|bearer /);
}

describe('ACF-001 OpenAPI contract harness (P0)', () => {
  it('loads the Identity & Tenant OpenAPI document', () => {
    const doc = loadOpenApi();
    expect(String(doc.openapi).startsWith('3.')).toBe(true);
    expect(doc.paths).toBeTypeOf('object');
    expect(doc.components?.schemas).toBeTypeOf('object');
  });

  it('includes critical Identity & Tenant paths from ACF-001', () => {
    const doc = loadOpenApi();
    const paths = doc.paths ?? {};

    const required = [
      '/auth/login',
      '/auth/me',
      '/tenants',
      '/tenants/current',
      '/organizations',
      '/memberships',
      '/permissions',
      '/roles',
      '/user-roles',
      '/me/mfa-factors',
    ];

    for (const p of required) {
      expect(paths, `missing path ${p}`).toHaveProperty(p);
    }
  });

  it('defines ErrorEnvelope component schema', () => {
    const doc = loadOpenApi();
    const schemas = doc.components?.schemas ?? {};
    expect(schemas).toHaveProperty('ErrorEnvelope');
  });

  it('accepts a valid error envelope fixture and rejects insecure shapes', () => {
    assertErrorEnvelope({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        requestId: '0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d',
        details: { fields: [{ path: 'email', issue: 'invalid_format' }] },
      },
    });

    expect(() =>
      assertErrorEnvelope({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'boom',
          // missing requestId
        },
      }),
    ).toThrow();

    expect(() =>
      assertErrorEnvelope({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'x',
          requestId: 'r1',
          stack: 'Error: secret',
        },
      }),
    ).toThrow();
  });

  it('does not embed live secrets in the OpenAPI artifact', () => {
    const raw = readFileSync(openApiPath, 'utf8').toLowerCase();
    expect(raw).not.toMatch(/sk_live|aws_secret|begin rsa private key/);
  });
});
