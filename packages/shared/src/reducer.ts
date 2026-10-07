import { compareByOrder } from './fractional-index';
import type { Op, OpPayload } from './ops';
import { CARD_PATCH_KEYS, type BoardState, type Card, type CardPatch } from './types';

export type ApplyResult = { ok: true; state: BoardState } | { ok: false; reason: string };

/**
 * Pure board reducer shared by client and server.
 *
 * - Never mutates its input; untouched entities keep referential identity so
 *   React can skip re-rendering them.
 * - Does **not** bump `version` — that is the authority's job (server, or the
 *   local authority in offline mode).
 * - Ops that reference entities which no longer exist are *rejected* rather
 *   than throwing. Under concurrency this is expected (e.g. someone moves a
 *   card another user just deleted) and the right outcome is a no-op.
 */
export function tryApplyOp(state: BoardState, op: Op | OpPayload): ApplyResult {
  switch (op.type) {
    case 'board.rename': {
      const title = op.title.trim();
      if (!title) return reject('Board title cannot be empty');
      return ok({ ...state, title });
    }

    case 'card.create': {
      const { card } = op;
      if (state.cards[card.id]) return reject(`Card ${card.id} already exists`);
      if (!state.columns[card.columnId]) return reject(`Column ${card.columnId} not found`);
      return ok({ ...state, cards: { ...state.cards, [card.id]: { ...card } } });
    }

    case 'card.update': {
      const card = state.cards[op.cardId];
      if (!card) return reject(`Card ${op.cardId} not found`);
      const patch = pickPatch(op.patch);
      // Per-field last-writer-wins: only the fields present in the patch change.
      // `updatedAt` comes from the op itself so every replica computes the same value.
      const updatedAt = 'ts' in op ? Math.max(card.updatedAt, op.ts) : card.updatedAt;
      const next: Card = { ...card, ...patch, updatedAt };
      return ok({ ...state, cards: { ...state.cards, [card.id]: next } });
    }

    case 'card.move': {
      const card = state.cards[op.cardId];
      if (!card) return reject(`Card ${op.cardId} not found`);
      if (!state.columns[op.toColumnId]) return reject(`Column ${op.toColumnId} not found`);
      const next: Card = { ...card, columnId: op.toColumnId, order: op.order };
      return ok({ ...state, cards: { ...state.cards, [card.id]: next } });
    }

    case 'card.delete': {
      if (!state.cards[op.cardId]) return reject(`Card ${op.cardId} not found`);
      const { [op.cardId]: _removed, ...cards } = state.cards;
      return ok({ ...state, cards });
    }

    case 'column.create': {
      if (state.columns[op.column.id]) return reject(`Column ${op.column.id} already exists`);
      return ok({ ...state, columns: { ...state.columns, [op.column.id]: { ...op.column } } });
    }

    case 'column.rename': {
      const column = state.columns[op.columnId];
      if (!column) return reject(`Column ${op.columnId} not found`);
      const title = op.title.trim();
      if (!title) return reject('Column title cannot be empty');
      return ok({ ...state, columns: { ...state.columns, [column.id]: { ...column, title } } });
    }

    case 'column.reorder': {
      const column = state.columns[op.columnId];
      if (!column) return reject(`Column ${op.columnId} not found`);
      return ok({
        ...state,
        columns: { ...state.columns, [column.id]: { ...column, order: op.order } },
      });
    }

    case 'column.delete': {
      if (!state.columns[op.columnId]) return reject(`Column ${op.columnId} not found`);
      const { [op.columnId]: _removed, ...columns } = state.columns;
      // Cards live in exactly one column, so deleting a column cascades.
      const cards: Record<string, Card> = {};
      for (const card of Object.values(state.cards)) {
        if (card.columnId !== op.columnId) cards[card.id] = card;
      }
      return ok({ ...state, columns, cards });
    }

    default: {
      const unknown: never = op;
      return reject(`Unknown op type: ${(unknown as { type: string }).type}`);
    }
  }
}

/** Convenience wrapper: returns the state unchanged when an op is rejected. */
export function applyOp(state: BoardState, op: Op | OpPayload): BoardState {
  const result = tryApplyOp(state, op);
  return result.ok ? result.state : state;
}

/** Applies a sequence of ops, skipping any that are rejected. */
export function applyOps(state: BoardState, ops: readonly (Op | OpPayload)[]): BoardState {
  return ops.reduce<BoardState>((acc, op) => applyOp(acc, op), state);
}

/**
 * Computes the ops that undo `op` given the state *before* it was applied.
 * Returns an empty array when the op cannot be meaningfully inverted.
 */
export function invertOp(before: BoardState, op: Op | OpPayload): OpPayload[] {
  switch (op.type) {
    case 'board.rename':
      return [{ type: 'board.rename', title: before.title }];
    case 'card.create':
      return [{ type: 'card.delete', cardId: op.card.id }];
    case 'card.update': {
      const card = before.cards[op.cardId];
      if (!card) return [];
      const patch: Record<string, unknown> = {};
      for (const key of Object.keys(pickPatch(op.patch)) as (keyof CardPatch)[]) {
        patch[key] = card[key];
      }
      return [{ type: 'card.update', cardId: card.id, patch: patch as CardPatch }];
    }
    case 'card.move': {
      const card = before.cards[op.cardId];
      if (!card) return [];
      return [{ type: 'card.move', cardId: card.id, toColumnId: card.columnId, order: card.order }];
    }
    case 'card.delete': {
      const card = before.cards[op.cardId];
      return card ? [{ type: 'card.create', card }] : [];
    }
    case 'column.create':
      return [{ type: 'column.delete', columnId: op.column.id }];
    case 'column.rename': {
      const column = before.columns[op.columnId];
      return column ? [{ type: 'column.rename', columnId: column.id, title: column.title }] : [];
    }
    case 'column.reorder': {
      const column = before.columns[op.columnId];
      return column ? [{ type: 'column.reorder', columnId: column.id, order: column.order }] : [];
    }
    case 'column.delete': {
      const column = before.columns[op.columnId];
      if (!column) return [];
      const cards = Object.values(before.cards)
        .filter((card) => card.columnId === column.id)
        .sort(compareByOrder);
      return [{ type: 'column.create', column }, ...cards.map((card): OpPayload => ({ type: 'card.create', card }))];
    }
    default:
      return [];
  }
}

/** Strips unknown keys so a malicious/buggy patch can't overwrite id/columnId/order. */
function pickPatch(patch: CardPatch): CardPatch {
  const clean: Record<string, unknown> = {};
  for (const key of CARD_PATCH_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) clean[key] = patch[key];
  }
  return clean as CardPatch;
}

function ok(state: BoardState): ApplyResult {
  return { ok: true, state };
}

function reject(reason: string): ApplyResult {
  return { ok: false, reason };
}
