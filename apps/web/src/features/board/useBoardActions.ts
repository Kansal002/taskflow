import {
  getColumnCards,
  getSortedColumns,
  orderAtEnd,
  type Card,
  type CardPatch,
  type OpPayload,
} from '@taskflow/shared';
import { useMemo } from 'react';
import { useToast } from '../../components/ui';
import { createId } from '../../lib/id';
import { useBoardStore } from '../../sync/boardStoreContext';

/**
 * Intent-level actions ("add a card to this column") translated into ops.
 * Order keys are computed from the store's *current* view at call time, so
 * they're always relative to the latest state, including other users' edits.
 */
export function useBoardActions() {
  const store = useBoardStore();
  const { toast } = useToast();

  return useMemo(() => {
    const board = () => store.getSnapshot().board;
    const dispatch = (payload: OpPayload | OpPayload[]) => store.dispatch(payload);

    const undoToast = (title: string) =>
      toast({ title, action: { label: 'Undo', onClick: () => store.undo() }, duration: 6000 });

    return {
      renameBoard(title: string) {
        dispatch({ type: 'board.rename', title });
      },

      createCard(columnId: string, title: string, extra: Partial<Card> = {}): string | null {
        const current = board();
        if (!current) return null;
        const now = Date.now();
        const card: Card = {
          id: createId('card'),
          columnId,
          order: orderAtEnd(getColumnCards(current, columnId)),
          title,
          description: '',
          labelIds: [],
          priority: 'none',
          assigneeId: null,
          dueDate: null,
          checklist: [],
          createdAt: now,
          updatedAt: now,
          ...extra,
        };
        return dispatch({ type: 'card.create', card }) ? card.id : null;
      },

      updateCard(cardId: string, patch: CardPatch) {
        dispatch({ type: 'card.update', cardId, patch });
      },

      moveCard(cardId: string, toColumnId: string, order: string) {
        dispatch({ type: 'card.move', cardId, toColumnId, order });
      },

      /** Moves a card to the end of another column (used by the card dialog's column picker). */
      moveCardToColumn(cardId: string, toColumnId: string) {
        const current = board();
        if (!current) return;
        const siblings = getColumnCards(current, toColumnId).filter((c) => c.id !== cardId);
        dispatch({ type: 'card.move', cardId, toColumnId, order: orderAtEnd(siblings) });
      },

      deleteCard(cardId: string) {
        const title = board()?.cards[cardId]?.title;
        if (dispatch({ type: 'card.delete', cardId })) undoToast(title ? `Deleted “${title}”` : 'Card deleted');
      },

      createColumn(title: string) {
        const current = board();
        if (!current) return;
        dispatch({
          type: 'column.create',
          column: { id: createId('col'), title, order: orderAtEnd(getSortedColumns(current)) },
        });
      },

      renameColumn(columnId: string, title: string) {
        dispatch({ type: 'column.rename', columnId, title });
      },

      reorderColumn(columnId: string, order: string) {
        dispatch({ type: 'column.reorder', columnId, order });
      },

      deleteColumn(columnId: string) {
        const current = board();
        const column = current?.columns[columnId];
        if (!current || !column) return;
        const count = getColumnCards(current, columnId).length;
        if (dispatch({ type: 'column.delete', columnId })) {
          undoToast(`Deleted column “${column.title}”${count ? ` and ${count} card${count === 1 ? '' : 's'}` : ''}`);
        }
      },

      undo() {
        return store.undo();
      },
    };
  }, [store, toast]);
}

export type BoardActions = ReturnType<typeof useBoardActions>;
