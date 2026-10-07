const DAY = 24 * 60 * 60 * 1000;

/** Parses a YYYY-MM-DD string as a *local* calendar date. */
function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later';

export function getDueState(iso: string, now = new Date()): DueState {
  const diffDays = Math.round((parseIsoDate(iso).getTime() - startOfToday(now).getTime()) / DAY);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 2) return 'soon';
  return 'later';
}

export function formatDueDate(iso: string, now = new Date()): string {
  const date = parseIsoDate(iso);
  const diffDays = Math.round((date.getTime() - startOfToday(now).getTime()) / DAY);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}
