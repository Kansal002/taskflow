import { PRIORITIES, type BoardState, type Card, type Priority } from '@taskflow/shared';

export interface CardFilters {
  query: string;
  labelId: string | null;
  priority: Priority | null;
  /** A member id, `'unassigned'`, or null for "anyone". */
  assigneeId: string | null;
}

export const EMPTY_FILTERS: CardFilters = { query: '', labelId: null, priority: null, assigneeId: null };

export const UNASSIGNED = 'unassigned';

export function hasActiveFilters(filters: CardFilters): boolean {
  return Boolean(filters.query.trim() || filters.labelId || filters.priority || filters.assigneeId);
}

/** Lower-cases and strips accents so "garcia" matches "García". */
function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Returns true when a card matches every active filter.
 * Text search is AND-ed across whitespace-separated terms and looks at the
 * title, description, label names, assignee name and checklist items.
 */
export function cardMatches(card: Card, filters: CardFilters, board: Pick<BoardState, 'labels' | 'members'>): boolean {
  if (filters.labelId && !card.labelIds.includes(filters.labelId)) return false;
  if (filters.priority && card.priority !== filters.priority) return false;
  if (filters.assigneeId) {
    if (filters.assigneeId === UNASSIGNED ? card.assigneeId !== null : card.assigneeId !== filters.assigneeId) {
      return false;
    }
  }
  const terms = normalise(filters.query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = normalise(
    [
      card.title,
      card.description,
      ...card.labelIds.map((id) => board.labels[id]?.name ?? ''),
      card.assigneeId ? (board.members[card.assigneeId]?.name ?? '') : '',
      ...card.checklist.map((item) => item.text),
    ].join('\n'),
  );
  return terms.every((term) => haystack.includes(term));
}

export function filterCards(
  cards: readonly Card[],
  filters: CardFilters,
  board: Pick<BoardState, 'labels' | 'members'>,
): Card[] {
  if (!hasActiveFilters(filters)) return [...cards];
  return cards.filter((card) => cardMatches(card, filters, board));
}

/** Parses filters from URL search params, ignoring unknown/invalid values. */
export function filtersFromParams(params: URLSearchParams): CardFilters {
  const priority = params.get('priority');
  return {
    query: params.get('q') ?? '',
    labelId: params.get('label') || null,
    priority: priority && (PRIORITIES as readonly string[]).includes(priority) ? (priority as Priority) : null,
    assigneeId: params.get('assignee') || null,
  };
}

export function filtersToParams(filters: CardFilters, base = new URLSearchParams()): URLSearchParams {
  const params = new URLSearchParams(base);
  const set = (key: string, value: string | null) => (value ? params.set(key, value) : params.delete(key));
  set('q', filters.query || null);
  set('label', filters.labelId);
  set('priority', filters.priority);
  set('assignee', filters.assigneeId);
  return params;
}
