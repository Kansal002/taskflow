import { compareByOrder, keyBetween } from './fractional-index';
import type { BoardState, Card, Column } from './types';

export function getSortedColumns(board: BoardState): Column[] {
  return Object.values(board.columns).sort(compareByOrder);
}

export function getColumnCards(board: BoardState, columnId: string): Card[] {
  return Object.values(board.cards)
    .filter((card) => card.columnId === columnId)
    .sort(compareByOrder);
}

/** Groups every card by column id, each list sorted by order. */
export function getCardsByColumn(board: BoardState): Record<string, Card[]> {
  const grouped: Record<string, Card[]> = {};
  for (const column of Object.values(board.columns)) grouped[column.id] = [];
  for (const card of Object.values(board.cards)) grouped[card.columnId]?.push(card);
  for (const list of Object.values(grouped)) list.sort(compareByOrder);
  return grouped;
}

/**
 * Computes an order key that places an item at `index` within `siblings`
 * (already sorted, and *excluding* the item being placed).
 *
 * Handles the rare case where neighbours share a key (two clients dropped into
 * the same gap concurrently) by searching forward for the next distinct key.
 */
export function orderForIndex(siblings: readonly { order: string }[], index: number): string {
  const clamped = Math.max(0, Math.min(index, siblings.length));
  const before = clamped > 0 ? (siblings[clamped - 1]?.order ?? null) : null;
  let after: string | null = null;
  for (let i = clamped; i < siblings.length; i++) {
    const candidate = siblings[i]?.order ?? null;
    if (candidate !== null && (before === null || candidate > before)) {
      after = candidate;
      break;
    }
  }
  return keyBetween(before, after);
}

/** Order key for appending to the end of a sorted list. */
export function orderAtEnd(siblings: readonly { order: string }[]): string {
  return orderForIndex(siblings, siblings.length);
}
