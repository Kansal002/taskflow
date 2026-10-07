import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import { focusRing } from './Button';
import { ToastContext, type ToastOptions, type ToastVariant } from './useToast';

interface ToastItem extends ToastOptions {
  id: number;
}

const MAX_TOASTS = 4;

/**
 * Provides `useToast()` and renders the notification viewport.
 *
 * The viewport is a *persistent* `aria-live` region (it exists before any
 * toast is added), which is what makes screen readers reliably announce new
 * toasts. Errors use an assertive region so they interrupt.
 * It is portalled to <body> so it stays interactive while a modal dialog
 * makes the app root `inert`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { ...options, id }].slice(-MAX_TOASTS));
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  const polite = toasts.filter((t) => t.variant !== 'error');
  const assertive = toasts.filter((t) => t.variant === 'error');

  return (
    <ToastContext value={value}>
      {children}
      {createPortal(
        <section
          aria-label="Notifications"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
        >
          <ol
            aria-live="polite"
            aria-relevant="additions"
            className="flex w-full flex-col items-center gap-2 sm:items-end"
          >
            {polite.map((t) => (
              <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </ol>
          <ol
            aria-live="assertive"
            aria-relevant="additions"
            className="flex w-full flex-col items-center gap-2 sm:items-end"
          >
            {assertive.map((t) => (
              <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </ol>
        </section>,
        document.body,
      )}
    </ToastContext>
  );
}

const icons: Record<ToastVariant, ReactNode> = {
  info: <Info className="text-accent-500" />,
  success: <CircleCheck className="text-emerald-500" />,
  error: <TriangleAlert className="text-red-500" />,
};

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { title, description, variant = 'info', action, duration = 5000 } = toast;
  const [paused, setPaused] = useState(false);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (paused || duration === Infinity) return;
    const timer = setTimeout(() => onDismissRef.current(), duration);
    return () => clearTimeout(timer);
  }, [paused, duration]);

  return (
    <li
      className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-lg shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-black/40"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span aria-hidden="true" className="mt-0.5 [&_svg]:size-4">
        {icons[variant]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{title}</p>
        {description && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
          className={cn(
            'shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-accent-600 hover:bg-accent-50 dark:text-accent-300 dark:hover:bg-accent-500/15',
            focusRing,
          )}
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className={cn(
          'shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 [&_svg]:size-3.5',
          focusRing,
        )}
      >
        <X />
      </button>
    </li>
  );
}
