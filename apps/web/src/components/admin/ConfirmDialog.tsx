'use client';

import { useEffect, useId, useRef } from 'react';

import { useAppPreferences } from '@/components/AppProviders';

/**
 * Accessible confirm dialog (IMP-027 / IMP-034) — replaces `window.confirm` for admin destructive actions.
 * Focuses Cancel on open; Esc / backdrop cancel when not busy; restores focus to opener on close.
 * Enter activates the focused control only (Cancel by default) — does not auto-confirm.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
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
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const { t } = useAppPreferences();
  const resolvedConfirm = confirmLabel ?? t('common.confirm');
  const resolvedCancel = cancelLabel ?? t('common.cancel');

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previouslyFocused.current = opener;
    cancelRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const el = previouslyFocused.current;
      previouslyFocused.current = null;
      if (el !== null && typeof el.focus === 'function') {
        queueMicrotask(() => {
          try {
            el.focus();
          } catch {
            /* opener may have unmounted */
          }
        });
      }
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="confirm-dialog-root" role="presentation">
      <button
        type="button"
        className="confirm-dialog-backdrop"
        aria-label={t('common.dismiss')}
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
            {resolvedCancel}
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? t('common.working') : resolvedConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
