import type { Priority } from '@taskflow/shared';
import { OctagonAlert, ChevronDown, ChevronUp, ChevronsUp, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

export const PRIORITY_META: Record<Priority, { label: string; icon: ReactNode; className: string }> = {
  none: { label: 'No priority', icon: <Minus />, className: 'text-zinc-400' },
  low: { label: 'Low', icon: <ChevronDown />, className: 'text-sky-600 dark:text-sky-400' },
  medium: { label: 'Medium', icon: <ChevronUp />, className: 'text-amber-600 dark:text-amber-400' },
  high: { label: 'High', icon: <ChevronsUp />, className: 'text-orange-600 dark:text-orange-400' },
  urgent: { label: 'Urgent', icon: <OctagonAlert />, className: 'text-red-600 dark:text-red-400' },
};
