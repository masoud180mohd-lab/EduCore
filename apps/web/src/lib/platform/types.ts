export const PLATFORM_TENANT_STATUSES = ['draft', 'active', 'suspended', 'closed'] as const;
export type PlatformTenantStatus = (typeof PLATFORM_TENANT_STATUSES)[number];

export const PLATFORM_ENTITLEMENT_CODES = ['sms', 'ai', 'payments.momo', 'student_portal'] as const;
export type PlatformEntitlementCode = (typeof PLATFORM_ENTITLEMENT_CODES)[number];

export type PlatformTenantListRow = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
  readonly primaryLocale: string;
  readonly timezone: string;
  readonly planCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PlatformEntitlementRow = {
  readonly code: string;
  readonly enabled: boolean;
  readonly limit: number | null;
};

export type PlatformTenantDetail = PlatformTenantListRow & {
  readonly entitlements: ReadonlyArray<PlatformEntitlementRow>;
};

export type PlatformPlanRow = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
};

export type PlatformAuditRow = {
  readonly id: string;
  readonly occurredAt: string;
  readonly action: string;
  readonly outcome: string;
  readonly actorUserId: string | null;
  readonly tenantId: string | null;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
};
