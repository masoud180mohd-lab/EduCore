/**
 * Load more control for cursor-paginated admin lists (IMP-030).
 * Hidden when nextCursor is null — never claim “all loaded” while more exist.
 */
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
  if (nextCursor === null || nextCursor === '') return null;

  return (
    <div className="resource-list-pagination">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={disabled || loadingMore}
        onClick={onLoadMore}
      >
        {loadingMore ? 'Loading more…' : 'Load more'}
      </button>
    </div>
  );
}
