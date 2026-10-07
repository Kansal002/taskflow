import { createDemoBoard, type Op, type ServerMessage } from '@taskflow/shared';
import { describe, expect, it, vi } from 'vitest';
import { BoardStore } from '../BoardStore';
import { Emitter, type ConnectionStatus, type SyncTransport } from '../transport';

/** Transport double that records sent ops and lets the test play the server. */
class FakeTransport implements SyncTransport {
  readonly kind = 'websocket' as const;
  status: ConnectionStatus = 'connecting';
  sent: Op[] = [];
  messages = new Emitter<ServerMessage>();
  statuses = new Emitter<ConnectionStatus>();
  connect = vi.fn();
  close = vi.fn();
  updatePresence = vi.fn();
  sendOp(op: Op) {
    this.sent.push(op);
  }
  onMessage(listener: (m: ServerMessage) => void) {
    return this.messages.on(listener);
  }
  onStatus(listener: (s: ConnectionStatus) => void) {
    return this.statuses.on(listener);
  }
  // test helpers
  server(message: ServerMessage) {
    this.messages.emit(message);
  }
  setStatus(status: ConnectionStatus) {
    this.status = status;
    this.statuses.emit(status);
  }
}

const NOW = Date.UTC(2026, 0, 1);

function setup() {
  const transport = new FakeTransport();
  const onReject = vi.fn();
  const store = new BoardStore(transport, { clientId: 'me', onReject });
  store.start();
  const base = createDemoBoard('demo', NOW);
  transport.server({ type: 'snapshot', board: base });
  return { transport, store, base, onReject };
}

describe('BoardStore', () => {
  it('starts the transport and exposes the snapshot', () => {
    const { transport, store } = setup();
    expect(transport.connect).toHaveBeenCalled();
    expect(store.getSnapshot().board?.title).toBe('Product Launch');
    expect(store.getSnapshot().pendingCount).toBe(0);
  });

  it('applies ops optimistically and sends them', () => {
    const { transport, store } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.dispatch({ type: 'board.rename', title: 'Optimistic' })).toBe(true);
    expect(store.getSnapshot().board?.title).toBe('Optimistic');
    expect(store.getSnapshot().pendingCount).toBe(1);
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toMatchObject({ type: 'board.rename', clientId: 'me' });
    expect(listener).toHaveBeenCalled();
  });

  it('refuses ops that cannot apply locally', () => {
    const { transport, store } = setup();
    expect(store.dispatch({ type: 'card.delete', cardId: 'ghost' })).toBe(false);
    expect(transport.sent).toHaveLength(0);
  });

  it('clears pending ops when the server echoes them back', () => {
    const { transport, store } = setup();
    store.dispatch({ type: 'board.rename', title: 'Mine' });
    const [op] = transport.sent;
    transport.server({ type: 'op', op: op!, version: 1 });
    expect(store.getSnapshot().pendingCount).toBe(0);
    expect(store.getSnapshot().board).toMatchObject({ title: 'Mine', version: 1 });
  });

  it('rebases pending local ops on top of remote ops', () => {
    const { transport, store } = setup();
    store.dispatch({ type: 'card.update', cardId: 'card-1', patch: { title: 'Local title' } });
    // Someone else changes a different field of the same card first.
    transport.server({
      type: 'op',
      op: { type: 'card.update', cardId: 'card-1', patch: { priority: 'urgent' }, id: 'remote', clientId: 'x', ts: 1 },
      version: 1,
    });
    expect(store.getSnapshot().board?.cards['card-1']).toMatchObject({ title: 'Local title', priority: 'urgent' });
    expect(store.getSnapshot().pendingCount).toBe(1);
  });

  it('rolls back and reports rejected ops', () => {
    const { transport, store, onReject } = setup();
    store.dispatch({ type: 'board.rename', title: 'Doomed' });
    const [op] = transport.sent;
    transport.server({ type: 'reject', opId: op!.id, reason: 'Nope' });
    expect(store.getSnapshot().board?.title).toBe('Product Launch');
    expect(onReject).toHaveBeenCalledWith('Nope', op);
  });

  it('keeps pending ops across a fresh snapshot (reconnect) until acked', () => {
    const { transport, store, base } = setup();
    store.dispatch({ type: 'board.rename', title: 'Typed while offline' });
    transport.server({ type: 'snapshot', board: { ...base, version: 5 } });
    expect(store.getSnapshot().board?.title).toBe('Typed while offline');
    transport.server({ type: 'ack', opId: transport.sent[0]!.id, version: 6 });
    expect(store.getSnapshot().pendingCount).toBe(0);
  });

  it('undoes the last action, including multi-op inverses', () => {
    const { store, base } = setup();
    const todoCount = Object.values(base.cards).filter((c) => c.columnId === 'col-todo').length;
    expect(store.getSnapshot().canUndo).toBe(false);

    store.dispatch({ type: 'column.delete', columnId: 'col-todo' });
    expect(store.getSnapshot().board?.columns['col-todo']).toBeUndefined();
    expect(store.getSnapshot().canUndo).toBe(true);

    expect(store.undo()).toBe(true);
    const restored = store.getSnapshot().board!;
    expect(restored.columns['col-todo']?.title).toBe('To Do');
    expect(Object.values(restored.cards).filter((c) => c.columnId === 'col-todo')).toHaveLength(todoCount);
    expect(store.getSnapshot().canUndo).toBe(false);
    expect(store.undo()).toBe(false);
  });

  it('caps the undo history', () => {
    const transport = new FakeTransport();
    const store = new BoardStore(transport, { clientId: 'me', maxUndo: 2 });
    transport.server({ type: 'snapshot', board: createDemoBoard('demo', NOW) });
    for (const title of ['a', 'b', 'c']) store.dispatch({ type: 'board.rename', title });
    expect(store.undo()).toBe(true);
    expect(store.undo()).toBe(true);
    expect(store.undo()).toBe(false);
    expect(store.getSnapshot().board?.title).toBe('a');
  });

  it('tracks presence and connection status', () => {
    const { transport, store } = setup();
    transport.server({ type: 'presence', users: [{ id: 'u', name: 'U', color: '#000000' }] });
    transport.setStatus('reconnecting');
    expect(store.getSnapshot()).toMatchObject({ status: 'reconnecting', presence: [{ name: 'U' }] });
    store.updatePresence({ id: 'u', name: 'V', color: '#000000' });
    expect(transport.updatePresence).toHaveBeenCalled();
  });

  it('ignores ops before the first snapshot and cleans up on destroy', () => {
    const transport = new FakeTransport();
    const store = new BoardStore(transport, { clientId: 'me' });
    transport.server({
      type: 'op',
      op: { type: 'board.rename', title: 'x', id: '1', clientId: 'y', ts: 0 },
      version: 1,
    });
    expect(store.getSnapshot().board).toBeNull();
    expect(store.dispatch({ type: 'board.rename', title: 'x' })).toBe(false);
    store.destroy();
    expect(transport.close).toHaveBeenCalled();
  });
});
