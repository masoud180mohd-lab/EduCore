/**
 * Shared post-login tenant bind (password + Auth0 + MFA verify).
 */
import { ApiClientError, apiRequest, type SessionAuth } from '@/lib/api/client';
import { resolvePostLoginPath } from '@/lib/auth/routing';
import { writeSession } from '@/lib/auth/session';

export type LoginTokens = {
  readonly accessToken: string;
  readonly tenantId: string | null;
  readonly mfaChallengeToken?: string | null;
};

export type TenantChoice = {
  readonly id: string;
  readonly name?: string;
  readonly code?: string;
};

export type CompleteLoginOutcome =
  | { readonly kind: 'routed'; readonly path: string }
  | {
      readonly kind: 'choose_tenant';
      readonly accessToken: string;
      readonly tenants: ReadonlyArray<TenantChoice>;
    }
  | {
      readonly kind: 'mfa_required';
      readonly mfaChallengeToken: string;
      readonly tenantId: string | null;
    }
  | { readonly kind: 'error'; readonly message: string };

type TenantList = {
  readonly data: ReadonlyArray<TenantChoice>;
};

type MfaVerifyResponse = {
  readonly data?: {
    readonly accessToken?: string;
    readonly tenantId?: string | null;
  };
};

async function fetchAccessibleTenants(accessToken: string): Promise<ReadonlyArray<TenantChoice>> {
  const base = (process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://127.0.0.1:3000').replace(
    /\/$/,
    '',
  );
  const response = await fetch(`${base}/api/v1/tenants`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const json = (await response.json()) as TenantList & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new ApiClientError({
      status: response.status,
      code: 'HTTP_ERROR',
      message: json.error?.message ?? 'Could not load schools.',
    });
  }
  return json.data ?? [];
}

export async function finishBoundSession(
  accessToken: string,
  boundTenant: string,
): Promise<string> {
  const auth: SessionAuth = { accessToken, tenantId: boundTenant };
  writeSession(auth);
  return resolvePostLoginPath(auth);
}

export async function completeLoginFromTokens(tokens: LoginTokens): Promise<CompleteLoginOutcome> {
  const challenge =
    typeof tokens.mfaChallengeToken === 'string' ? tokens.mfaChallengeToken.trim() : '';
  if (challenge !== '') {
    return {
      kind: 'mfa_required',
      mfaChallengeToken: challenge,
      tenantId: tokens.tenantId,
    };
  }

  const accessToken = tokens.accessToken;
  if (accessToken === '') {
    return { kind: 'error', message: 'Login failed — no access token returned.' };
  }

  let boundTenant = tokens.tenantId;
  if (boundTenant === null || boundTenant === '') {
    const list = await fetchAccessibleTenants(accessToken);
    if (list.length === 0) {
      return { kind: 'error', message: 'No school membership found for this account.' };
    }
    if (list.length === 1) {
      boundTenant = list[0]?.id ?? null;
    } else {
      return { kind: 'choose_tenant', accessToken, tenants: list };
    }
  }

  if (boundTenant === null || boundTenant === '') {
    return { kind: 'error', message: 'Could not bind a school (tenant).' };
  }

  const path = await finishBoundSession(accessToken, boundTenant);
  return { kind: 'routed', path };
}

export async function verifyMfaAndComplete(input: {
  readonly mfaChallengeToken: string;
  readonly code: string;
}): Promise<CompleteLoginOutcome> {
  const result = await apiRequest<MfaVerifyResponse>('/api/v1/auth/mfa/verify', {
    method: 'POST',
    body: {
      mfaChallengeToken: input.mfaChallengeToken,
      code: input.code,
    },
    requireTenant: false,
  });

  return completeLoginFromTokens({
    accessToken: result.data?.accessToken ?? '',
    tenantId: result.data?.tenantId ?? null,
    mfaChallengeToken: null,
  });
}

export async function selectTenantAndFinish(
  accessToken: string,
  tenantId: string,
): Promise<string> {
  await apiRequest('/api/v1/auth/select-tenant', {
    method: 'POST',
    body: { tenantId },
    auth: { accessToken, tenantId },
  });
  return finishBoundSession(accessToken, tenantId);
}
