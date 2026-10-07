import { X } from 'lucide-react';
import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import { getFocusable } from './focus';
import { IconButton } from './IconButton';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Rendered as the dialog's heading and used as its accessible name. */
  title: ReactNode;
  /** Optional supporting text, wired up as the accessible description. */
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Element to focus on open. Defaults to the first focusable element in the body. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}

/** Counts open dialogs so nested/stacked dialogs restore `inert` correctly. */
let openDialogs = 0;

const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

/**
 * Modal dialog following the WAI-ARIA dialog pattern:
 * - `role="dialog"` + `aria-modal`, labelled by its title and described by its description
 * - focus moves into the dialog on open and is trapped there (Tab / Shift+Tab wrap)
 * - Escape or clicking the backdrop closes it
 * - focus returns to the element that opened it
 * - the rest of the app is made `inert` and page scroll is locked while open
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocusRef,
  className,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pointerDownOnBackdrop = useRef(false);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    // Focus: explicit target → first focusable in the body → the panel itself.
    const target =
      initialFocusRef?.current ?? (bodyRef.current ? getFocusable(bodyRef.current)[0] : undefined) ?? panel;
    target?.focus();

    // Hide the app from assistive tech and pointer/keyboard interaction.
    const appRoot = document.getElementById('root');
    openDialogs += 1;
    appRoot?.setAttribute('inert', '');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      openDialogs -= 1;
      if (openDialogs === 0) appRoot?.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
    // Only re-run when opening/closing; initialFocusRef is a stable ref object.
  }, [open, initialFocusRef]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = getFocusable(panelRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // Close only if the press both started and ended on the backdrop (not a text-selection drag).
  const onBackdropPointerDown = (event: MouseEvent) => {
    pointerDownOnBackdrop.current = event.target === event.currentTarget;
  };
  const onBackdropClick = (event: MouseEvent) => {
    if (pointerDownOnBackdrop.current && event.target === event.currentTarget) onClose();
    pointerDownOnBackdrop.current = false;
  };

  return createPortal(
    // Backdrop click is a pointer convenience; Escape and the close button are the keyboard equivalents.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center overflow-y-auto bg-zinc-950/40 p-0 backdrop-blur-[2px] sm:items-start sm:p-4 sm:pt-[8vh] dark:bg-black/60"
      onMouseDown={onBackdropPointerDown}
      onClick={onBackdropClick}
    >
      {/* Key handling (Escape, focus trap) belongs on the dialog container per the APG dialog pattern. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          'relative flex max-h-[92vh] w-full animate-scale-in flex-col rounded-t-2xl bg-white shadow-2xl ring-1 ring-zinc-900/10 outline-none sm:max-h-[84vh] sm:rounded-xl dark:bg-zinc-900 dark:ring-white/10',
          sizes[size],
          className,
        )}
      >
        <div className="flex items-start gap-3 border-b border-zinc-100 px-5 pt-4 pb-3 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close dialog" size="sm" onClick={onClose} showTooltip={false} className="-mr-1.5">
            <X />
          </IconButton>
        </div>
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
