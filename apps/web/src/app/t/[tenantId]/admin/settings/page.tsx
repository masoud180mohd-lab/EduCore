'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest, teacherFriendlyMessage } from '@/lib/api/client';
import { readSession } from '@/lib/auth/session';

export default function AdminSettingsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const [doc, setDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const result = await apiRequest<{ data: unknown }>('/api/v1/tenant-settings', { auth });
        setDoc(JSON.stringify(result.data, null, 2));
      } catch (err) {
        if (err instanceof ApiClientError) setError(teacherFriendlyMessage(err));
        else setError('Could not load settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AdminShell tenantId={tenantId}>
      <h1>Settings</h1>
      <p className="muted">Read-only tenant settings document (edit deferred).</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {doc !== null ? (
        <pre
          className="card"
          style={{ overflow: 'auto', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}
        >
          {doc}
        </pre>
      ) : null}
    </AdminShell>
  );
}
