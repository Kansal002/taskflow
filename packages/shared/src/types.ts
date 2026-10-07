/**
 * Domain model for a TaskFlow board.
 *
 * The board is stored *normalised* (maps keyed by id rather than nested
 * arrays). That keeps every operation small and lets concurrent edits to
 * different entities — or different fields of the same entity — merge
 * without stepping on each other.
 *
 * Ordering is expressed with fractional-index strings (`order`) instead of
 * array positions, so moving one card never rewrites its siblings.
 */

export type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITIES: readonly Priority[] = ['none', 'low', 'medium', 'high', 'urgent'];

export type LabelColor = 'red' | 'orange' | 'amber' | 'green' | 'teal' | 'blue' | 'violet' | 'pink';

export interface Label {
  id: string;
  name: string;
  color: LabelColor;
}

export interface Member {
  id: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Card {
  id: string;
  columnId: string;
  /** Fractional index — compare lexicographically. */
  order: string;
  title: string;
  description: string;
  labelIds: string[];
  priority: Priority;
  assigneeId: string | null;
  /** ISO date (YYYY-MM-DD) or null. */
  dueDate: string | null;
  checklist: ChecklistItem[];
  createdAt: number;
  updatedAt: number;
}

export interface Column {
  id: string;
  title: string;
  order: string;
}

export interface BoardState {
  id: string;
  title: string;
  columns: Record<string, Column>;
  cards: Record<string, Card>;
  labels: Record<string, Label>;
  members: Record<string, Member>;
  /** Monotonically increasing; bumped by the authority for every applied op. */
  version: number;
}

/** Fields of a card that `card.update` is allowed to patch. */
export type CardPatch = Partial<
  Pick<Card, 'title' | 'description' | 'labelIds' | 'priority' | 'assigneeId' | 'dueDate' | 'checklist'>
>;

export const CARD_PATCH_KEYS = [
  'title',
  'description',
  'labelIds',
  'priority',
  'assigneeId',
  'dueDate',
  'checklist',
] as const satisfies readonly (keyof CardPatch)[];

/** A connected collaborator, as shown in the presence bar. */
export interface PresenceUser {
  id: string;
  name: string;
  color: string;
}
