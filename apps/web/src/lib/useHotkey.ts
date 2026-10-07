import { useEffect, useRef } from 'react';

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Global keyboard shortcut. Ignored while typing in a form field so native
 * behaviour (e.g. undo inside a textarea) keeps working.
 */
export function useHotkey(matches: (event: KeyboardEvent) => boolean, handler: (event: KeyboardEvent) => void) {
  const matchesRef = useRef(matches);
  const handlerRef = useRef(handler);
  useEffect(() => {
    matchesRef.current = matches;
    handlerRef.current = handler;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      if (matchesRef.current(event)) handlerRef.current(event);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
