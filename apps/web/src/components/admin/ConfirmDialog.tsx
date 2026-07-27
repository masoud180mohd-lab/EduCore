'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * Accessible confirm dialog (IMP-027) — replaces `window.confirm` for admin destructive actions.
 * Focuses the cancel button on open; Esc closes without confirming.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly body: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly danger?: boolean;
  readonly busy?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="confirm-dialog-root" role="presentation">
      <button
        type="button"
        className="confirm-dialog-backdrop"
        aria-label="Dismiss"
        disabled={busy}
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        className="confirm-dialog card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="section-title">
          {title}
        </h2>
        <p className="muted">{body}</p>
        <div className="actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
