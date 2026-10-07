import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { badgeColors, dotColors, type BadgeColor } from './badgeStyles';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
  /** Show a coloured dot before the text — colour is never the only signal. */
  dot?: boolean;
}

/** Small inline status/label pill. Text always carries the meaning; colour is decoration. */
export function Badge({ color = 'neutral', dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-4 font-medium ring-1 ring-inset',
        badgeColors[color],
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', dotColors[color])} />}
      <span className="truncate">{children}</span>
    </span>
  );
}
