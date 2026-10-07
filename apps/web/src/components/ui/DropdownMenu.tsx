import { Check } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import { usePopoverPosition, type Align } from './usePopoverPosition';

export type MenuEntry =
  | {
      type?: 'item';
      id: string;
      label: string;
      icon?: ReactNode;
      /** Secondary text on the right, e.g. a shortcut. */
      hint?: string;
      danger?: boolean;
      disabled?: boolean;
      /** When defined the item is rendered as `menuitemradio` with this checked state. */
      checked?: boolean;
      onSelect: () => void;
    }
  | { type: 'separator'; id: string }
  | { type: 'label'; id: string; label: string };

type MenuItem = Extract<MenuEntry, { onSelect: () => void }>;

export interface MenuTriggerProps {
  ref: Ref<HTMLButtonElement>;
  id: string;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export interface DropdownMenuProps {
  /** Render prop for the trigger; spread the given props onto a button. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  items: readonly MenuEntry[];
  /** Accessible name for the menu (defaults to the trigger via aria-labelledby). */
  label?: string;
  align?: Align;
  className?: string;
}

const isItem = (entry: MenuEntry): entry is MenuItem => entry.type === undefined || entry.type === 'item';

/**
 * Menu button following the WAI-ARIA menu pattern:
 * - trigger has `aria-haspopup="menu"` / `aria-expanded`
 * - Enter, Space or ArrowDown opens and focuses the first item; ArrowUp the last
 * - roving tabindex: ArrowUp/ArrowDown move (wrapping), Home/End jump,
 *   typing a character jumps to the next matching item
 * - Enter/Space selects; Escape closes and returns focus to the trigger;
 *   Tab closes and lets focus move on naturally
 */
export function DropdownMenu({ trigger, items, label, align = 'start', className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerId = useId();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const menuItems = items.filter(isItem);
  const enabledIndexes = menuItems.flatMap((item, i) => (item.disabled ? [] : [i]));

  usePopoverPosition(open, triggerRef, menuRef, 'bottom', align);

  // Move DOM focus whenever the active item changes while open.
  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  // Close on outside pointer down.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const openAt = (position: 'first' | 'last') => {
    if (enabledIndexes.length === 0) return;
    setActiveIndex((position === 'first' ? enabledIndexes[0] : enabledIndexes[enabledIndexes.length - 1]) ?? 0);
    setOpen(true);
  };

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const move = (delta: 1 | -1) => {
    if (enabledIndexes.length === 0) return;
    const position = enabledIndexes.indexOf(activeIndex);
    const next = (position + delta + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[next] ?? 0);
  };

  const select = (item: MenuItem) => {
    if (item.disabled) return;
    close(true);
    item.onSelect();
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openAt('first');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openAt('last');
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(enabledIndexes[0] ?? 0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(enabledIndexes[enabledIndexes.length - 1] ?? 0);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation(); // don't also close a surrounding dialog
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          // Typeahead: next enabled item whose label starts with the typed character.
          const char = event.key.toLowerCase();
          const ordered = [
            ...enabledIndexes.filter((i) => i > activeIndex),
            ...enabledIndexes.filter((i) => i <= activeIndex),
          ];
          const match = ordered.find((i) => menuItems[i]?.label.toLowerCase().startsWith(char));
          if (match !== undefined) setActiveIndex(match);
        }
    }
  };

  const indexById = new Map(menuItems.map((item, i) => [item.id, i]));

  return (
    <>
      {trigger({
        ref: triggerRef,
        id: triggerId,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
        onClick: () => (open ? close(false) : openAt('first')),
        onKeyDown: onTriggerKeyDown,
      })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            tabIndex={-1}
            aria-label={label}
            aria-labelledby={label ? undefined : triggerId}
            aria-orientation="vertical"
            onKeyDown={onMenuKeyDown}
            style={{ position: 'fixed', top: 0, left: 0 }}
            className={cn(
              'z-[55] max-h-[60vh] min-w-48 animate-scale-in overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg shadow-zinc-900/10 scrollbar-thin dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-black/40',
              className,
            )}
          >
            {items.map((entry) => {
              if (entry.type === 'separator') {
                return <div key={entry.id} role="separator" className="my-1 h-px bg-zinc-100 dark:bg-zinc-700" />;
              }
              if (entry.type === 'label') {
                return (
                  <div
                    key={entry.id}
                    role="presentation"
                    className="px-2 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase"
                  >
                    {entry.label}
                  </div>
                );
              }
              const index = indexById.get(entry.id) ?? -1;
              const isRadio = entry.checked !== undefined;
              return (
                <button
                  key={entry.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  role={isRadio ? 'menuitemradio' : 'menuitem'}
                  aria-checked={isRadio ? entry.checked : undefined}
                  aria-disabled={entry.disabled || undefined}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onClick={() => select(entry)}
                  onPointerMove={() => !entry.disabled && index !== activeIndex && setActiveIndex(index)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none [&_svg]:size-4 [&_svg]:shrink-0',
                    'focus:bg-zinc-100 dark:focus:bg-zinc-700',
                    entry.danger
                      ? 'text-red-600 focus:bg-red-50 dark:text-red-400 dark:focus:bg-red-500/15'
                      : 'text-zinc-700 dark:text-zinc-200',
                    entry.disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  {entry.icon && (
                    <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-500">
                      {entry.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  {entry.hint && <span className="text-xs text-zinc-400">{entry.hint}</span>}
                  {isRadio && (
                    <Check aria-hidden="true" className={cn('text-accent-600', !entry.checked && 'invisible')} />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
