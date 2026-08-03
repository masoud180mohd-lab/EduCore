'use client';

import { useParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import {
  AdminPageHeader,
  AdminTable,
  Banner,
  ConfirmDialog,
  ResourceList,
  ResourceListPagination,
  StatusChip,
} from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { canNotificationManage, visibleAdminNavIds } from '@/lib/auth/admin-access';
import type { MeLike } from '@/lib/auth/home-preference';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';
import {
  DELIVERY_STATUS_FILTERS,
  formatPhoneLast4,
  NOTIFICATION_LOCALES,
  payloadKeysForTemplate,
  requestStatusLabel,
  shortId,
  TEMPLATE_PAYLOAD_ALLOWLISTS,
  type NotificationDelivery,
  type NotificationLocale,
  type NotificationRequest,
  type NotificationTemplate,
  type NotificationUsage,
} from '@/lib/notifications/types';

type GuardianOption = {
  readonly id: string;
  readonly displayName: string;
  readonly phone: string | null;
  readonly status: string;
};

type MeEnvelope = { readonly data: MeLike };

const GUARDIAN_PICKER_LIMIT = 100;

export default function AdminNotificationsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;

  const [canRead, setCanRead] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [gateReady, setGateReady] = useState(false);

  const [usage, setUsage] = useState<NotificationUsage | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [requestIdFilter, setRequestIdFilter] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');
  const [appliedRequestId, setAppliedRequestId] = useState('');

  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [guardians, setGuardians] = useState<GuardianOption[]>([]);
  const [templateCode, setTemplateCode] = useState('comms_test_sms');
  const [locale, setLocale] = useState<NotificationLocale>('sw');
  const [guardianId, setGuardianId] = useState('');
  const [payload, setPayload] = useState<Record<string, string>>({ school_name: '' });
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendInfo, setSendInfo] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const payloadKeys = useMemo(() => payloadKeysForTemplate(templateCode), [templateCode]);

  const selectedGuardian = useMemo(
    () => guardians.find((g) => g.id === guardianId) ?? null,
    [guardians, guardianId],
  );

  const localeTemplates = useMemo(
    () => templates.filter((t) => t.locale === locale && t.code === templateCode),
    [templates, locale, templateCode],
  );

  const previewBody = localeTemplates[0]?.body ?? null;

  const uniqueTemplateCodes = useMemo(() => {
    const codes = new Set(templates.map((t) => t.code));
    return [...codes].sort();
  }, [templates]);

  useEffect(() => {
    const keys = payloadKeysForTemplate(templateCode);
    setPayload((prev) => {
      const next: Record<string, string> = {};
      for (const key of keys) {
        next[key] = prev[key] ?? '';
      }
      return next;
    });
  }, [templateCode]);

  const loadUsage = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    setUsageLoading(true);
    try {
      const result = await apiRequest<{ data: NotificationUsage }>('/api/v1/notifications/usage', {
        auth,
      });
      setUsage(result.data);
      setUsageError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setUsageError(adminFriendlyMessage(err, 'notifications'));
      else setUsageError('Could not load SMS usage.');
    } finally {
      setUsageLoading(false);
    }
  }, []);

  const loadDeliveries = useCallback(
    async (opts: {
      readonly cursor: string | null;
      readonly append: boolean;
      readonly status: string;
      readonly requestId: string;
    }) => {
      const auth = readSession();
      if (auth === null) return;
      if (opts.append) setLoadingMore(true);
      else setListLoading(true);
      try {
        const q = buildListQuery('/api/v1/notifications/deliveries', {
          limit: ADMIN_LIST_DEFAULT_LIMIT,
          cursor: opts.cursor,
          filters: {
            status: opts.status === '' ? undefined : opts.status,
            requestId: opts.requestId.trim() === '' ? undefined : opts.requestId.trim(),
          },
        });
        const result = await apiRequest<PaginatedEnvelope<NotificationDelivery>>(q, { auth });
        const page = readPageMeta(result);
        setDeliveries((prev) =>
          opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
        );
        setNextCursor(page.nextCursor);
        setListError(null);
      } catch (err) {
        if (err instanceof ApiClientError) setListError(adminFriendlyMessage(err, 'notifications'));
        else setListError('Could not load deliveries.');
        if (!opts.append) setDeliveries([]);
      } finally {
        setListLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  const loadSendFormData = useCallback(async () => {
    const auth = readSession();
    if (auth === null) return;
    try {
      const [tplRes, gRes] = await Promise.all([
        apiRequest<{ data: NotificationTemplate[] }>('/api/v1/notification-templates', { auth }),
        apiRequest<{ data: GuardianOption[] }>(
          buildListQuery('/api/v1/guardians', { limit: GUARDIAN_PICKER_LIMIT }),
          { auth },
        ),
      ]);
      setTemplates(tplRes.data ?? []);
      setGuardians(gRes.data ?? []);
    } catch {
      // Form stays usable; send will surface API errors.
    }
  }, []);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const me = await apiRequest<MeEnvelope>('/api/v1/auth/me', { auth });
        const nav = visibleAdminNavIds(me.data);
        const read = nav.has('notifications');
        const manage = canNotificationManage(me.data);
        setCanRead(read);
        setCanManage(manage);
        setGateReady(true);
        if (!read) return;
        void loadUsage();
        void loadDeliveries({
          cursor: null,
          append: false,
          status: '',
          requestId: '',
        });
        if (manage) void loadSendFormData();
      } catch {
        setGateReady(true);
        setCanRead(false);
      }
    })();
  }, [loadUsage, loadDeliveries, loadSendFormData]);

  async function runSend() {
    const auth = readSession();
    if (auth === null || guardianId === '') return;
    setSendBusy(true);
    setSendError(null);
    setSendInfo(null);
    const actionKey = `notification.request:${templateCode}:${locale}:${guardianId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    const bodyPayload: Record<string, string> = {};
    for (const key of payloadKeys) {
      const value = (payload[key] ?? '').trim();
      if (value !== '') bodyPayload[key] = value;
    }
    try {
      const result = await apiRequest<{ data: NotificationRequest }>(
        '/api/v1/notifications/requests',
        {
          method: 'POST',
          auth,
          body: {
            templateCode,
            locale,
            recipientType: 'guardian',
            recipientId: guardianId,
            payload: bodyPayload,
          },
          idempotencyKey: idem,
        },
      );
      clearIdempotencyKey(actionKey);
      setConfirmOpen(false);
      const row = result.data;
      setSendInfo(
        `Request ${shortId(row.id)} — ${requestStatusLabel(row.status, row.skipReason)}.`,
      );
      void loadUsage();
      void loadDeliveries({
        cursor: null,
        append: false,
        status: appliedStatus,
        requestId: appliedRequestId,
      });
    } catch (err) {
      if (err instanceof ApiClientError) setSendError(adminFriendlyMessage(err, 'notifications'));
      else setSendError('Could not send SMS.');
    } finally {
      setSendBusy(false);
    }
  }

  function onFilter(event: FormEvent) {
    event.preventDefault();
    setAppliedStatus(statusFilter);
    setAppliedRequestId(requestIdFilter);
    void loadDeliveries({
      cursor: null,
      append: false,
      status: statusFilter,
      requestId: requestIdFilter,
    });
  }

  return (
    <AdminShell tenantId={tenantId}>
      <AdminPageHeader
        title="SMS notifications"
        description="Delivery ledger, daily usage, and manual test SMS (ACF-014). Full phone numbers are never shown."
      />

      {!gateReady ? <p className="muted">Checking access…</p> : null}

      {gateReady && !canRead ? (
        <Banner tone="error">You do not have notification access.</Banner>
      ) : null}

      {gateReady && canRead ? (
        <div className="stack">
          <section className="card stack">
            <h2 className="section-title">Usage today (UTC)</h2>
            {usageLoading ? <p className="muted">Loading…</p> : null}
            {usageError !== null ? <Banner tone="error">{usageError}</Banner> : null}
            {usage !== null ? (
              <p className="muted">
                Date {usage.usageDate} · Sent {usage.sentCount} · Segments {usage.segmentCount}
                {usage.bypassDailyCap
                  ? ' · Daily cap bypassed (lab)'
                  : usage.dailyCap !== null
                    ? ` · Cap ${String(usage.dailyCap)}`
                    : ' · Cap unset'}
              </p>
            ) : null}
          </section>

          {canManage ? (
            <section className="card stack">
              <h2 className="section-title">Send test SMS</h2>
              <p className="muted">
                Recipient type is guardian (v1). Prefer template <code>comms_test_sms</code>.
                Payload keys must match the template allowlist.
              </p>
              {sendError !== null ? <Banner tone="error">{sendError}</Banner> : null}
              {sendInfo !== null ? <Banner tone="info">{sendInfo}</Banner> : null}

              <div className="field">
                <label htmlFor="tpl-code">Template</label>
                <select
                  id="tpl-code"
                  value={templateCode}
                  onChange={(e) => setTemplateCode(e.target.value)}
                >
                  {(uniqueTemplateCodes.length > 0
                    ? uniqueTemplateCodes
                    : Object.keys(TEMPLATE_PAYLOAD_ALLOWLISTS)
                  ).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="tpl-locale">Locale</label>
                <select
                  id="tpl-locale"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as NotificationLocale)}
                >
                  {NOTIFICATION_LOCALES.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="tpl-guardian">Guardian</label>
                <select
                  id="tpl-guardian"
                  required
                  value={guardianId}
                  onChange={(e) => setGuardianId(e.target.value)}
                >
                  <option value="">Select guardian</option>
                  {guardians.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.displayName}
                      {g.phone !== null && g.phone !== '' ? ' · has phone' : ' · no phone'}
                    </option>
                  ))}
                </select>
              </div>

              {payloadKeys.map((key) => (
                <div className="field" key={key}>
                  <label htmlFor={`payload-${key}`}>{key}</label>
                  <input
                    id={`payload-${key}`}
                    value={payload[key] ?? ''}
                    onChange={(e) =>
                      setPayload((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    maxLength={200}
                    placeholder={`{{${key}}}`}
                  />
                </div>
              ))}

              {previewBody !== null ? (
                <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                  Preview ({locale}): {previewBody}
                </p>
              ) : null}

              <button
                type="button"
                className="btn btn-primary"
                disabled={sendBusy || guardianId === ''}
                onClick={() => setConfirmOpen(true)}
              >
                Send SMS…
              </button>
            </section>
          ) : (
            <Banner tone="info">
              You can view deliveries. Sending SMS requires notification.manage.
            </Banner>
          )}

          <section className="stack">
            <h2 className="section-title">Deliveries</h2>
            <form className="stack" onSubmit={onFilter}>
              <div className="field">
                <label htmlFor="del-status">Status</label>
                <select
                  id="del-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {DELIVERY_STATUS_FILTERS.map((opt) => (
                    <option key={opt.label} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="del-request">Request id (optional)</label>
                <input
                  id="del-request"
                  value={requestIdFilter}
                  onChange={(e) => setRequestIdFilter(e.target.value)}
                  placeholder="UUID"
                />
              </div>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={listLoading || loadingMore}
              >
                Apply filters
              </button>
            </form>

            {listError !== null ? <Banner tone="error">{listError}</Banner> : null}

            <ResourceList
              loading={listLoading}
              empty="No deliveries yet."
              isEmpty={deliveries.length === 0}
              variant="table"
              footer={
                <ResourceListPagination
                  nextCursor={nextCursor}
                  loadingMore={loadingMore}
                  onLoadMore={() => {
                    void loadDeliveries({
                      cursor: nextCursor,
                      append: true,
                      status: appliedStatus,
                      requestId: appliedRequestId,
                    });
                  }}
                />
              }
            >
              <AdminTable
                caption="SMS deliveries"
                headers={['Created', 'Status', 'Request', 'Provider', 'Phone', 'Segments', 'Error']}
              >
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="muted">{new Date(d.createdAt).toLocaleString()}</td>
                    <td>
                      <StatusChip label={d.status} />
                    </td>
                    <td className="muted" title={d.requestId}>
                      {shortId(d.requestId)}
                    </td>
                    <td>{d.providerCode}</td>
                    <td>{formatPhoneLast4(d.phoneLast4)}</td>
                    <td>{d.segmentCount ?? '—'}</td>
                    <td className="muted">{d.errorCode ?? '—'}</td>
                  </tr>
                ))}
              </AdminTable>
            </ResourceList>
          </section>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Send SMS?"
        body={
          selectedGuardian !== null
            ? `Send template “${templateCode}” (${locale}) to guardian “${selectedGuardian.displayName}”? If they have no phone, the request will be skipped (no_phone).`
            : 'Send this SMS?'
        }
        confirmLabel="Send"
        danger={false}
        busy={sendBusy}
        onCancel={() => {
          if (!sendBusy) setConfirmOpen(false);
        }}
        onConfirm={() => {
          void runSend();
        }}
      />
    </AdminShell>
  );
}
