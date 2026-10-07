import type { Card, CardPatch, Column } from './types';

/**
 * Operations are the *only* way board state changes. They are small,
 * JSON-serialisable and replayable, which is what lets the same reducer run
 * optimistically in the browser and authoritatively on the server.
 */
export type OpPayload =
  | { type: 'board.rename'; title: string }
  | { type: 'card.create'; card: Card }
  | { type: 'card.update'; cardId: string; patch: CardPatch }
  | { type: 'card.move'; cardId: string; toColumnId: string; order: string }
  | { type: 'card.delete'; cardId: string }
  | { type: 'column.create'; column: Column }
  | { type: 'column.rename'; columnId: string; title: string }
  | { type: 'column.reorder'; columnId: string; order: string }
  | { type: 'column.delete'; columnId: string };

export interface OpMeta {
  /** Client-generated unique id; used for acks and server-side de-duplication. */
  id: string;
  /** Id of the client (browser tab) that produced the op. */
  clientId: string;
  /** Client wall-clock time, informational only — never used for ordering. */
  ts: number;
}

export type Op = OpPayload & OpMeta;

export type OpType = Op['type'];

export const OP_TYPES = [
  'board.rename',
  'card.create',
  'card.update',
  'card.move',
  'card.delete',
  'column.create',
  'column.rename',
  'column.reorder',
  'column.delete',
] as const satisfies readonly OpType[];

/** Distributes metadata over each member of the payload union. */
export function withMeta(payload: OpPayload, meta: OpMeta): Op {
  return { ...payload, ...meta } as Op;
}
