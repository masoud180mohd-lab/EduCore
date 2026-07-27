import Link from 'next/link';

import type { DependentGroup } from '@/lib/academic/dependents';
import { dependentAdminHref, dependentTypeLabel } from '@/lib/academic/dependents';

type Props = {
  readonly tenantId: string;
  readonly groups: ReadonlyArray<DependentGroup>;
};

export function DeleteDependentsBanner({ tenantId, groups }: Props) {
  if (groups.length === 0) return null;

  return (
    <div className="banner banner-error stack" role="alert" style={{ gap: '0.75rem' }}>
      <p style={{ margin: 0 }}>Remove or reassign these items before deleting:</p>
      <ul className="list" style={{ margin: 0 }}>
        {groups.map((group) => (
          <li key={group.type}>
            <strong>
              {dependentTypeLabel(group.type)} ({group.count})
            </strong>
            {group.samples.length > 0 ? (
              <ul className="list" style={{ marginTop: '0.35rem' }}>
                {group.samples.map((sample) => {
                  const href = dependentAdminHref(tenantId, group.type, sample.id);
                  return (
                    <li key={sample.id}>
                      {href !== null ? <Link href={href}>{sample.label}</Link> : sample.label}
                    </li>
                  );
                })}
                {group.count > group.samples.length ? (
                  <li className="muted">+{group.count - group.samples.length} more not shown</li>
                ) : null}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
