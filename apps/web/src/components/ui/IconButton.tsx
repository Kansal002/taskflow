import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from '../../lib/cn';
import { focusRing } from './Button';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Accessible name — required because the button has no visible text. Also shown as a tooltip. */
  label: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'secondary';
  /** Set to false to suppress the tooltip (e.g. inside a menu trigger that is already labelled). */
  showTooltip?: boolean;
  /** Optional keyboard shortcut hint, shown in the tooltip. */
  shortcut?: string;
  ref?: Ref<HTMLButtonElement>;
}

/** Square icon-only button. Enforces an accessible label at the type level. */
export function IconButton({
  label,
  size = 'md',
  variant = 'ghost',
  showTooltip = true,
  shortcut,
  className,
  type = 'button',
  ref,
  ...props
}: IconButtonProps) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        focusRing,
        size === 'sm' ? 'size-7 [&_svg]:size-3.5' : 'size-9 [&_svg]:size-4',
        variant === 'ghost'
          ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
          : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700',
        className,
      )}
      {...props}
    />
  );
  if (!showTooltip) return button;
  return (
    // The label already names the button, so the tooltip is purely visual.
    <Tooltip content={shortcut ? `${label} (${shortcut})` : label} describeChild={false}>
      {button}
    </Tooltip>
  );
}
