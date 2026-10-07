import { describe, expect, it } from 'vitest';
import type { Op, OpPayload } from '../ops';
import { applyOp, applyOps, invertOp, tryApplyOp } from '../reducer';
import { createDemoBoard, createEmptyBoard } from '../seed';
import { getColumnCards, getSortedColumns, orderAtEnd, orderForIndex } from '../selectors';
import type { BoardState, Card } from '../types';

const NOW = Date.UTC(2026, 0, 15, 12);

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'new-card',
    columnId: 'col-todo',
    order: 'z',
    title: 'New card',
    description: '',
    labelIds: [],
    priority: 'none',
    assigneeId: null,
    dueDate: null,
    checklist: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function op(payload: OpPayload, id = Math.random().toString(36).slice(2)): Op {
  return { ...payload, id, clientId: 'test', ts: NOW + 1000 } as Op;
}

function titles(board: BoardState, columnId: string) {
  return getColumnCards(board, columnId).map((c) => c.title);
}

describe('board reducer', () => {
  const board = createDemoBoard('demo', NOW);

  it('seeds a deterministic demo board', () => {
    expect(createDemoBoard('demo', NOW)).toEqual(board);
    expect(getSortedColumns(board).map((c) => c.title)).toEqual(['To Do', 'In Progress', 'Review', 'Done']);
    expect(Object.keys(board.cards).length).toBeGreaterThan(5);
  });

  it('board.rename trims and rejects empty titles', () => {
    expect(applyOp(board, { type: 'board.rename', title: '  Roadmap ' }).title).toBe('Roadmap');
    expect(tryApplyOp(board, { type: 'board.rename', title: '   ' }).ok).toBe(false);
  });

  it('card.create adds a card and rejects duplicates / unknown columns', () => {
    const next = applyOp(board, { type: 'card.create', card: makeCard() });
    expect(next.cards['new-card']?.title).toBe('New card');
    expect(board.cards['new-card']).toBeUndefined(); // input not mutated
    expect(tryApplyOp(next, { type: 'card.create', card: makeCard() }).ok).toBe(false);
    expect(tryApplyOp(board, { type: 'card.create', card: makeCard({ columnId: 'nope' }) }).ok).toBe(false);
  });

  it('card.update patches only the given fields (per-field LWW)', () => {
    const a = applyOp(board, op({ type: 'card.update', cardId: 'card-1', patch: { title: 'Renamed' } }));
    const b = applyOp(a, op({ type: 'card.update', cardId: 'card-1', patch: { priority: 'urgent' } }));
    expect(b.cards['card-1']).toMatchObject({ title: 'Renamed', priority: 'urgent' });
    expect(b.cards['card-1']?.description).toBe(board.cards['card-1']?.description);
    expect(b.cards['card-1']?.updatedAt).toBe(NOW + 1000);
  });

  it('card.update ignores keys outside the patchable set', () => {
    const next = applyOp(board, {
      type: 'card.update',
      cardId: 'card-1',
      patch: { title: 'ok', columnId: 'col-done', id: 'hijack' } as never,
    });
    expect(next.cards['card-1']).toMatchObject({ id: 'card-1', columnId: 'col-todo', title: 'ok' });
  });

  it('card.update on a missing card is rejected', () => {
    expect(tryApplyOp(board, { type: 'card.update', cardId: 'ghost', patch: { title: 'x' } }).ok).toBe(false);
  });

  it('card.move moves within and across columns', () => {
    const todo = getColumnCards(board, 'col-todo');
    // Move the last To Do card to the top of To Do.
    const last = todo[todo.length - 1]!;
    const withinOrder = orderForIndex(
      todo.filter((c) => c.id !== last.id),
      0,
    );
    const within = applyOp(board, { type: 'card.move', cardId: last.id, toColumnId: 'col-todo', order: withinOrder });
    expect(titles(within, 'col-todo')[0]).toBe(last.title);

    // Move it to the end of Done.
    const done = getColumnCards(within, 'col-done');
    const across = applyOp(within, {
      type: 'card.move',
      cardId: last.id,
      toColumnId: 'col-done',
      order: orderAtEnd(done),
    });
    expect(titles(across, 'col-done').at(-1)).toBe(last.title);
    expect(titles(across, 'col-todo')).not.toContain(last.title);
  });

  it('card.move to a deleted column is rejected', () => {
    expect(tryApplyOp(board, { type: 'card.move', cardId: 'card-1', toColumnId: 'gone', order: 'V' }).ok).toBe(false);
  });

  it('card.delete removes the card', () => {
    const next = applyOp(board, { type: 'card.delete', cardId: 'card-1' });
    expect(next.cards['card-1']).toBeUndefined();
    expect(tryApplyOp(next, { type: 'card.delete', cardId: 'card-1' }).ok).toBe(false);
  });

  it('column.create / rename / reorder / delete', () => {
    const columns = getSortedColumns(board);
    const created = applyOp(board, {
      type: 'column.create',
      column: { id: 'col-new', title: 'Backlog', order: orderForIndex(columns, 0) },
    });
    expect(getSortedColumns(created)[0]?.title).toBe('Backlog');
    expect(tryApplyOp(created, { type: 'column.create', column: { id: 'col-new', title: 'x', order: 'V' } }).ok).toBe(
      false,
    );

    const renamed = applyOp(created, { type: 'column.rename', columnId: 'col-new', title: 'Icebox' });
    expect(renamed.columns['col-new']?.title).toBe('Icebox');
    expect(tryApplyOp(renamed, { type: 'column.rename', columnId: 'col-new', title: ' ' }).ok).toBe(false);

    const reordered = applyOp(renamed, {
      type: 'column.reorder',
      columnId: 'col-new',
      order: orderAtEnd(getSortedColumns(renamed)),
    });
    expect(getSortedColumns(reordered).at(-1)?.title).toBe('Icebox');

    const deleted = applyOp(reordered, { type: 'column.delete', columnId: 'col-todo' });
    expect(deleted.columns['col-todo']).toBeUndefined();
    // Cascade: its cards are gone too.
    expect(Object.values(deleted.cards).some((c) => c.columnId === 'col-todo')).toBe(false);
  });

  it('keeps referential identity of untouched entities', () => {
    const next = applyOp(board, { type: 'card.update', cardId: 'card-1', patch: { title: 'x' } });
    expect(next.cards['card-2']).toBe(board.cards['card-2']);
    expect(next.columns).toBe(board.columns);
  });

  it('applyOps skips rejected ops and keeps going', () => {
    const next = applyOps(board, [
      { type: 'card.delete', cardId: 'ghost' },
      { type: 'board.rename', title: 'After' },
    ]);
    expect(next.title).toBe('After');
  });
});

describe('concurrent edits converge', () => {
  const base = createDemoBoard('demo', NOW);

  it('two clients moving different cards into the same column both land', () => {
    const done = getColumnCards(base, 'col-done');
    // Both clients compute their move against the same (stale) snapshot.
    const moveA = op({ type: 'card.move', cardId: 'card-1', toColumnId: 'col-done', order: orderAtEnd(done) }, 'a');
    const moveB = op(
      { type: 'card.move', cardId: 'card-2', toColumnId: 'col-done', order: orderForIndex(done, 0) },
      'b',
    );

    const serverOrderAB = applyOps(base, [moveA, moveB]);
    const serverOrderBA = applyOps(base, [moveB, moveA]);
    expect(titles(serverOrderAB, 'col-done')).toEqual(titles(serverOrderBA, 'col-done'));
    expect(titles(serverOrderAB, 'col-done')[0]).toBe(base.cards['card-2']!.title);
    expect(titles(serverOrderAB, 'col-done').at(-1)).toBe(base.cards['card-1']!.title);
  });

  it('two clients dropping into the same gap get a deterministic tie-break', () => {
    const done = getColumnCards(base, 'col-done');
    const sameKey = orderForIndex(done, 1);
    const moveA = op({ type: 'card.move', cardId: 'card-3', toColumnId: 'col-done', order: sameKey });
    const moveB = op({ type: 'card.move', cardId: 'card-1', toColumnId: 'col-done', order: sameKey });
    const ab = titles(applyOps(base, [moveA, moveB]), 'col-done');
    const ba = titles(applyOps(base, [moveB, moveA]), 'col-done');
    expect(ab).toEqual(ba);

    // A later insert into that tied gap still succeeds.
    const tied = getColumnCards(applyOps(base, [moveA, moveB]), 'col-done');
    expect(() => orderForIndex(tied, 2)).not.toThrow();
    const key = orderForIndex(tied, 2);
    expect(key > tied[1]!.order).toBe(true);
  });

  it('concurrent updates to different fields of the same card both survive', () => {
    const a = op({ type: 'card.update', cardId: 'card-1', patch: { title: 'From A' } });
    const b = op({ type: 'card.update', cardId: 'card-1', patch: { priority: 'urgent' } });
    const merged = applyOps(base, [a, b]);
    expect(merged.cards['card-1']).toMatchObject({ title: 'From A', priority: 'urgent' });
  });

  it('a move of a concurrently deleted card is a safe no-op', () => {
    const del = op({ type: 'card.delete', cardId: 'card-1' });
    const move = op({ type: 'card.move', cardId: 'card-1', toColumnId: 'col-done', order: 'z' });
    const next = applyOps(base, [del, move]);
    expect(next.cards['card-1']).toBeUndefined();
  });
});

describe('invertOp', () => {
  const base = createDemoBoard('demo', NOW);
  const cases: [string, OpPayload][] = [
    ['board.rename', { type: 'board.rename', title: 'New title' }],
    ['card.create', { type: 'card.create', card: makeCard() }],
    ['card.update', { type: 'card.update', cardId: 'card-1', patch: { title: 'X', dueDate: null } }],
    ['card.move', { type: 'card.move', cardId: 'card-1', toColumnId: 'col-done', order: 'zz' }],
    ['card.delete', { type: 'card.delete', cardId: 'card-5' }],
    ['column.create', { type: 'column.create', column: { id: 'c-x', title: 'X', order: 'zz' } }],
    ['column.rename', { type: 'column.rename', columnId: 'col-todo', title: 'Later' }],
    ['column.reorder', { type: 'column.reorder', columnId: 'col-todo', order: 'zz' }],
    ['column.delete', { type: 'column.delete', columnId: 'col-progress' }],
  ];

  it.each(cases)('%s round-trips back to the original state', (_name, payload) => {
    const after = applyOp(base, payload);
    expect(after).not.toEqual(base);
    const restored = applyOps(after, invertOp(base, payload));
    expect(restored).toEqual(base);
  });

  it('returns no ops for entities that did not exist', () => {
    const empty = createEmptyBoard('x');
    expect(invertOp(empty, { type: 'card.delete', cardId: 'ghost' })).toEqual([]);
    expect(invertOp(empty, { type: 'card.update', cardId: 'ghost', patch: { title: 'x' } })).toEqual([]);
  });
});
