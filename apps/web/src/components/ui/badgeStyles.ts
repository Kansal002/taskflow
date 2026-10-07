import type { LabelColor } from '@taskflow/shared';

export type BadgeColor = LabelColor | 'neutral' | 'accent';

/** Literal class strings (not interpolated) so Tailwind can see them at build time. */
export const badgeColors: Record<BadgeColor, string> = {
  neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-500/15 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-400/20',
  accent:
    'bg-accent-50 text-accent-700 ring-accent-600/20 dark:bg-accent-500/15 dark:text-accent-300 dark:ring-accent-400/25',
  red: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/25',
  orange:
    'bg-orange-50 text-orange-700 ring-orange-600/15 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/25',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25',
  green: 'bg-green-50 text-green-700 ring-green-600/15 dark:bg-green-500/15 dark:text-green-300 dark:ring-green-400/25',
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/15 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-400/25',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/25',
  violet:
    'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/25',
  pink: 'bg-pink-50 text-pink-700 ring-pink-600/15 dark:bg-pink-500/15 dark:text-pink-300 dark:ring-pink-400/25',
};

export const dotColors: Record<BadgeColor, string> = {
  neutral: 'bg-zinc-400',
  accent: 'bg-accent-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  green: 'bg-green-500',
  teal: 'bg-teal-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  pink: 'bg-pink-500',
};
