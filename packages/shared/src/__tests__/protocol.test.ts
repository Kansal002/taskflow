import { describe, expect, it } from 'vitest';
import { isOp, isValidBoardId, parseClientMessage, parseServerMessage } from '../protocol';
import { createDemoBoard } from '../seed';

const meta = { id: 'op-1', clientId: 'c-1', ts: 1 };
const user = { id: 'u-1', name: 'Ada', color: '#123abc' };

describe('parseClientMessage', () => {
  it('accepts a valid join', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'join', boardId: 'demo', user }))).toEqual({
      type: 'join',
      boardId: 'demo',
      user,
    });
  });

  it('rejects malformed JSON and unknown types', () => {
    expect(parseClientMessage('{nope')).toBeNull();
    expect(parseClientMessage('[]')).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'hack' }))).toBeNull();
  });

  it('rejects invalid board ids and presence users', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'join', boardId: '../etc', user }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'presence', user: { ...user, color: 'red' } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: 'presence', user }))).not.toBeNull();
  });

  it('validates every op type', () => {
    const card = createDemoBoard('demo', 0).cards['card-1'];
    const valid = [
      { type: 'board.rename', title: 'x' },
      { type: 'card.create', card },
      { type: 'card.update', cardId: 'card-1', patch: { title: 'x', priority: 'high', dueDate: '2026-01-01' } },
      { type: 'card.move', cardId: 'card-1', toColumnId: 'col-done', order: 'V' },
      { type: 'card.delete', cardId: 'card-1' },
      { type: 'column.create', column: { id: 'c', title: 'C', order: 'V' } },
      { type: 'column.rename', columnId: 'c', title: 'C' },
      { type: 'column.reorder', columnId: 'c', order: 'V' },
      { type: 'column.delete', columnId: 'c' },
    ];
    for (const payload of valid) {
      expect(isOp({ ...payload, ...meta }), payload.type).toBe(true);
      expect(parseClientMessage(JSON.stringify({ type: 'op', op: { ...payload, ...meta } }))).not.toBeNull();
    }
  });

  it('rejects ops with bad fields', () => {
    const invalid = [
      { type: 'card.update', cardId: 'card-1', patch: {} },
      { type: 'card.update', cardId: 'card-1', patch: { columnId: 'x' } },
      { type: 'card.update', cardId: 'card-1', patch: { priority: 'critical' } },
      { type: 'card.update', cardId: 'card-1', patch: { dueDate: 'tomorrow' } },
      { type: 'card.move', cardId: 'card-1', toColumnId: 'c', order: 'V0' },
      { type: 'column.create', column: { id: '', title: 'C', order: 'V' } },
      { type: 'board.rename', title: 'x'.repeat(500) },
      { type: 'nope' },
    ];
    for (const payload of invalid) expect(isOp({ ...payload, ...meta })).toBe(false);
    expect(isOp({ type: 'card.delete', cardId: 'x' })).toBe(false); // missing meta
  });
});

describe('misc', () => {
  it('isValidBoardId', () => {
    expect(isValidBoardId('my-board_1')).toBe(true);
    expect(isValidBoardId('')).toBe(false);
    expect(isValidBoardId('a b')).toBe(false);
    expect(isValidBoardId(42)).toBe(false);
  });

  it('parseServerMessage', () => {
    expect(parseServerMessage('{"type":"presence","users":[]}')).toEqual({ type: 'presence', users: [] });
    expect(parseServerMessage('oops')).toBeNull();
    expect(parseServerMessage('{"no":"type"}')).toBeNull();
  });
});
