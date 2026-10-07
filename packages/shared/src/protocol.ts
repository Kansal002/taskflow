import { isValidOrderKey } from './fractional-index';
import type { Op } from './ops';
import { PRIORITIES, type BoardState, type Card, type ChecklistItem, type Column, type PresenceUser } from './types';

/**
 * Wire protocol between a client and the sync authority.
 *
 *   client ── join ───────────▶ server     (subscribe to a board)
 *   client ◀─ snapshot ──────── server     (full state + version)
 *   client ── op ─────────────▶ server     (optimistic op, carries client op id)
 *   client ◀─ op (broadcast) ── server     (authoritative, with new version; doubles as ack)
 *   client ◀─ ack ───────────── server     (duplicate op already applied — resend after reconnect)
 *   client ◀─ reject ────────── server     (op could not be applied; client rolls back)
 *   client ◀─ presence ──────── server     (who is in the room)
 */
export type ClientMessage =
  | { type: 'join'; boardId: string; user: PresenceUser }
  | { type: 'op'; op: Op }
  | { type: 'presence'; user: PresenceUser };

export type ServerMessage =
  | { type: 'snapshot'; board: BoardState }
  | { type: 'op'; op: Op; version: number }
  | { type: 'ack'; opId: string; version: number }
  | { type: 'reject'; opId: string; reason: string }
  | { type: 'presence'; users: PresenceUser[] }
  | { type: 'error'; message: string };

export const LIMITS = {
  idLength: 64,
  titleLength: 200,
  descriptionLength: 10_000,
  nameLength: 40,
  checklistItems: 100,
  labelsPerCard: 20,
  orderKeyLength: 128,
} as const;

const BOARD_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidBoardId(id: unknown): id is string {
  return typeof id === 'string' && BOARD_ID_RE.test(id);
}

// ---------------------------------------------------------------------------
// Runtime validation. The server must never trust what arrives on the socket,
// so every inbound message is checked structurally before it reaches the
// reducer. Hand-rolled (rather than a schema library) to keep the shared
// package dependency-free.
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= LIMITS.idLength;
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isOrder = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= LIMITS.orderKeyLength && isValidOrderKey(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isDate = (v: unknown): v is string | null =>
  v === null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v));

export function isPresenceUser(v: unknown): v is PresenceUser {
  return (
    isObject(v) &&
    isId(v.id) &&
    isText(v.name, LIMITS.nameLength) &&
    typeof v.color === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(v.color)
  );
}

function isChecklist(v: unknown): v is ChecklistItem[] {
  return (
    Array.isArray(v) &&
    v.length <= LIMITS.checklistItems &&
    v.every(
      (item) =>
        isObject(item) && isId(item.id) && isText(item.text, LIMITS.titleLength) && typeof item.done === 'boolean',
    )
  );
}

function isLabelIds(v: unknown): v is string[] {
  return Array.isArray(v) && v.length <= LIMITS.labelsPerCard && v.every(isId);
}

function isCard(v: unknown): v is Card {
  return (
    isObject(v) &&
    isId(v.id) &&
    isId(v.columnId) &&
    isOrder(v.order) &&
    isText(v.title, LIMITS.titleLength) &&
    isText(v.description, LIMITS.descriptionLength) &&
    isLabelIds(v.labelIds) &&
    PRIORITIES.includes(v.priority as never) &&
    (v.assigneeId === null || isId(v.assigneeId)) &&
    isDate(v.dueDate) &&
    isChecklist(v.checklist) &&
    isFiniteNumber(v.createdAt) &&
    isFiniteNumber(v.updatedAt)
  );
}

function isColumn(v: unknown): v is Column {
  return isObject(v) && isId(v.id) && isText(v.title, LIMITS.titleLength) && isOrder(v.order);
}

function isCardPatch(v: unknown): boolean {
  if (!isObject(v)) return false;
  const checks: Record<string, (value: unknown) => boolean> = {
    title: (x) => isText(x, LIMITS.titleLength),
    description: (x) => isText(x, LIMITS.descriptionLength),
    labelIds: isLabelIds,
    priority: (x) => PRIORITIES.includes(x as never),
    assigneeId: (x) => x === null || isId(x),
    dueDate: isDate,
    checklist: isChecklist,
  };
  const keys = Object.keys(v);
  return keys.length > 0 && keys.every((key) => checks[key]?.(v[key]) ?? false);
}

export function isOp(v: unknown): v is Op {
  if (!isObject(v) || !isId(v.id) || !isId(v.clientId) || !isFiniteNumber(v.ts)) return false;
  switch (v.type) {
    case 'board.rename':
      return isText(v.title, LIMITS.titleLength);
    case 'card.create':
      return isCard(v.card);
    case 'card.update':
      return isId(v.cardId) && isCardPatch(v.patch);
    case 'card.move':
      return isId(v.cardId) && isId(v.toColumnId) && isOrder(v.order);
    case 'card.delete':
      return isId(v.cardId);
    case 'column.create':
      return isColumn(v.column);
    case 'column.rename':
      return isId(v.columnId) && isText(v.title, LIMITS.titleLength);
    case 'column.reorder':
      return isId(v.columnId) && isOrder(v.order);
    case 'column.delete':
      return isId(v.columnId);
    default:
      return false;
  }
}

/** Parses and validates a raw socket frame. Returns `null` for anything malformed. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(data)) return null;
  switch (data.type) {
    case 'join':
      return isValidBoardId(data.boardId) && isPresenceUser(data.user)
        ? { type: 'join', boardId: data.boardId, user: data.user }
        : null;
    case 'op':
      return isOp(data.op) ? { type: 'op', op: data.op } : null;
    case 'presence':
      return isPresenceUser(data.user) ? { type: 'presence', user: data.user } : null;
    default:
      return null;
  }
}

/** Light structural check for messages coming *from* the server. */
export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (!isObject(data) || typeof data.type !== 'string') return null;
    return data as ServerMessage;
  } catch {
    return null;
  }
}
