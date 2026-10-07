import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core';

export type DragTarget =
  | { kind: 'card'; title: string; columnTitle: string; index: number; total: number }
  | { kind: 'column'; title: string; index: number; total: number };

export interface DragLookup {
  /** Describes `id` where it currently is, or — given `overId` — where it would land. */
  describe(id: UniqueIdentifier, overId?: UniqueIdentifier): DragTarget;
}

export const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'To pick up a card or column, press Space. While dragging, use the arrow keys to move it. ' +
    'Press Space or Enter to drop it, or Escape to cancel. Press Enter on a card to open its details.',
};

function where(target: DragTarget): string {
  const position = `position ${target.index + 1} of ${target.total}`;
  return target.kind === 'card' ? `in column “${target.columnTitle}”, ${position}` : position;
}

/**
 * Human-friendly live-region messages for drag and drop, using card and
 * column *names* instead of dnd-kit's default internal ids.
 */
export function buildAnnouncements(lookup: DragLookup): Announcements {
  // dnd-kit reports the item as "over itself" right after pickup; skip that so
  // the pick-up message isn't immediately replaced by a redundant one.
  let hasMoved = false;
  return {
    onDragStart({ active }) {
      hasMoved = false;
      const target = lookup.describe(active.id);
      return `Picked up ${target.kind} “${target.title}”, ${where(target)}.`;
    },
    onDragOver({ active, over }) {
      if (!over) return undefined;
      if (!hasMoved && over.id === active.id) return undefined;
      hasMoved = true;
      const target = lookup.describe(active.id, over.id);
      return `${capitalise(target.kind)} “${target.title}” is now ${where(target)}.`;
    },
    onDragEnd({ active, over }) {
      const target = lookup.describe(active.id);
      if (!over) return `${capitalise(target.kind)} “${target.title}” was dropped outside the board. No changes made.`;
      return `${capitalise(target.kind)} “${target.title}” was dropped ${where(lookup.describe(active.id, over.id))}.`;
    },
    onDragCancel({ active }) {
      const target = lookup.describe(active.id);
      return `Moving was cancelled. ${capitalise(target.kind)} “${target.title}” returned to its original position.`;
    },
  };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
