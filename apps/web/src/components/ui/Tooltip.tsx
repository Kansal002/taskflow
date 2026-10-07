import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { usePopoverPosition } from './usePopoverPosition';

export interface TooltipProps {
  content: string;
  /** A single focusable element (usually a button). */
  children: ReactElement<{ 'aria-describedby'?: string }>;
  side?: 'top' | 'bottom';
  /** Hover delay in ms. Keyboard focus shows the tooltip immediately. */
  delay?: number;
  /**
   * When true (default) the tooltip text is exposed as the trigger's
   * accessible *description* via `aria-describedby`. Set to false when the
   * text merely repeats the trigger's accessible name (e.g. icon buttons),
   * so screen readers don't announce it twice.
   */
  describeChild?: boolean;
}

/**
 * Hover/focus tooltip following the WAI-ARIA tooltip pattern:
 * shows on hover (after a delay) and on keyboard focus, hides on blur,
 * pointer leave and Escape. Never contains interactive content.
 */
export function Tooltip({ content, children, side = 'top', delay = 400, describeChild = true }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  usePopoverPosition(open, anchorRef, floatingRef, side, 'center');

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = (immediate: boolean) => {
    clearTimeout(timer.current);
    if (immediate) setOpen(true);
    else timer.current = setTimeout(() => setOpen(true), delay);
  };

  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  const onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') show(false);
  };

  const onFocus = (event: FocusEvent) => {
    // Only for keyboard focus — clicking a button shouldn't pop a tooltip.
    const target = event.target as HTMLElement;
    if (typeof target.matches === 'function' && safeMatches(target, ':focus-visible')) show(true);
  };

  const trigger = describeChild
    ? cloneElement(children, {
        'aria-describedby': [children.props['aria-describedby'], id].filter(Boolean).join(' '),
      })
    : children;

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onPointerEnter={onPointerEnter}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={onFocus}
      onBlur={hide}
    >
      {trigger}
      {describeChild && (
        <span id={id} role="tooltip" className="sr-only">
          {content}
        </span>
      )}
      {open &&
        createPortal(
          <div
            ref={floatingRef}
            aria-hidden="true"
            style={{ position: 'fixed', top: 0, left: 0 }}
            className="pointer-events-none z-[60] max-w-64 animate-fade-in rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
}

function safeMatches(element: HTMLElement, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    // Very old engines / jsdom without :focus-visible support.
    return true;
  }
}
