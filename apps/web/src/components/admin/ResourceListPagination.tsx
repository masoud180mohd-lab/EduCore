'use client';

import { useAppPreferences } from '@/components/AppProviders';
export function ResourceListPagination({
  nextCursor,
  loadingMore,
  onLoadMore,
  disabled = false,
}: {
  readonly nextCursor: string | null;
  readonly loadingMore: boolean;
  readonly onLoadMore: () => void;
  readonly disabled?: boolean;
}) {
  const { t } = useAppPreferences();
  if (nextCursor === null || nextCursor === '') return null;

  return (
    <div className="resource-list-pagination">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={disabled || loadingMore}
        onClick={onLoadMore}
      >
        {loadingMore ? t('common.loadingMore') : t('common.loadMore')}
      </button>
    </div>
  );
}
