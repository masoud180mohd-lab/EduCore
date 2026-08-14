'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAppPreferences } from '@/components/AppProviders';
import { apiRequest } from '@/lib/api/client';
import type { MeLike } from '@/lib/auth/home-preference';
import { readSession } from '@/lib/auth/session';
import {
  visibleWorkspaces,
  workspaceFromPath,
  workspaceHref,
  type WorkspaceId,
} from '@/lib/auth/workspace';
import type { MessageKey } from '@/lib/i18n/messages';

const LABELS: Record<WorkspaceId, MessageKey> = {
  office: 'shell.office',
  teacher: 'teacher.nav',
  parent: 'parent.nav',
};

/**
 * Jump between office / teacher / parent shells (owner/admin preview all three).
 * Student is shown disabled — there is no student login portal.
 */
export function WorkspaceSwitcher({ tenantId }: { readonly tenantId: string }) {
  const pathname = usePathname();
  const { t } = useAppPreferences();
  const [ids, setIds] = useState<ReadonlyArray<WorkspaceId>>([]);
  const current = workspaceFromPath(pathname);

  useEffect(() => {
    const auth = readSession();
    if (auth === null) return;
    void (async () => {
      try {
        const me = await apiRequest<{ data: MeLike }>('/api/v1/auth/me', { auth });
        setIds(visibleWorkspaces(me.data));
      } catch {
        setIds([]);
      }
    })();
  }, []);

  if (ids.length === 0) return null;

  return (
    <nav className="workspace-switch" aria-label={t('shell.workspace')}>
      {ids.map((id) => {
        const href = workspaceHref(tenantId, id);
        const active = current === id;
        return (
          <Link
            key={id}
            href={href}
            className={active ? 'admin-console-chip is-active' : 'admin-console-chip'}
            aria-current={active ? 'page' : undefined}
          >
            {t(LABELS[id])}
          </Link>
        );
      })}
      <span
        className="admin-console-chip is-disabled"
        title={t('shell.studentPortalHint')}
        aria-disabled="true"
      >
        {t('shell.student')}
      </span>
    </nav>
  );
}
