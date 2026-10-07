import { useLayoutEffect, type RefObject } from 'react';

export type Placement = 'top' | 'bottom';
export type Align = 'start' | 'center' | 'end';

export interface PopoverPosition {
  top: number;
  left: number;
  placement: Placement;
}

const GAP = 6;
const VIEWPORT_PADDING = 8;

/**
 * Computes a `position: fixed` location for a floating element anchored to a
 * trigger, flipping above/below to stay on screen. Rendering floating UI in a
 * portal with fixed positioning means it is never clipped by scrolling
 * columns or `overflow: hidden` ancestors.
 */
export function computePosition(
  anchor: DOMRect,
  floating: { width: number; height: number },
  preferred: Placement,
  align: Align,
  viewport = { width: window.innerWidth, height: window.innerHeight },
): PopoverPosition {
  const spaceBelow = viewport.height - anchor.bottom;
  const spaceAbove = anchor.top;
  const fitsBelow = spaceBelow >= floating.height + GAP + VIEWPORT_PADDING;
  const fitsAbove = spaceAbove >= floating.height + GAP + VIEWPORT_PADDING;
  const placement: Placement =
    preferred === 'bottom' ? (fitsBelow || !fitsAbove ? 'bottom' : 'top') : fitsAbove || !fitsBelow ? 'top' : 'bottom';

  const top = placement === 'bottom' ? anchor.bottom + GAP : anchor.top - GAP - floating.height;
  let left =
    align === 'start'
      ? anchor.left
      : align === 'end'
        ? anchor.right - floating.width
        : anchor.left + anchor.width / 2 - floating.width / 2;
  left = Math.max(VIEWPORT_PADDING, Math.min(left, viewport.width - floating.width - VIEWPORT_PADDING));
  return { top: Math.max(VIEWPORT_PADDING, top), left, placement };
}

/**
 * Keeps a floating element (rendered with `position: fixed`) attached to its
 * anchor while open. Writes styles directly to the DOM in a layout effect —
 * before paint, without extra React renders on every scroll event.
 */
export function usePopoverPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  floatingRef: RefObject<HTMLElement | null>,
  preferred: Placement = 'bottom',
  align: Align = 'start',
): void {
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current;
      const floating = floatingRef.current;
      if (!anchor || !floating) return;
      const { top, left, placement } = computePosition(
        anchor.getBoundingClientRect(),
        { width: floating.offsetWidth, height: floating.offsetHeight },
        preferred,
        align,
      );
      floating.style.top = `${top}px`;
      floating.style.left = `${left}px`;
      floating.dataset.placement = placement;
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef, floatingRef, preferred, align]);
}
