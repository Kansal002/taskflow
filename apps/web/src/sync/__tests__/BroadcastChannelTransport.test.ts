import type { Op, ServerMessage } from '@taskflow/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BroadcastChannelTransport, storageKeyForBoard } from '../BroadcastChannelTransport';

/** In-memory BroadcastChannel bus: messages reach every *other* channel with the same name. */
function createBus() {
  const channels = new Set<{ name: string; onmessage: ((e: MessageEvent) => void) | null }>();
  return (name: string) => {
    const channel = {
      name,
      onmessage: null as ((e: MessageEvent) => void) | null,
      postMessage(data: unknown) {
        for (const other of channels) {
          if (other !== channel && other.name === name)
            other.onmessage?.({ data: structuredClone(data) } as MessageEvent);
        }
      },
      close() {
        channels.delete(channel);
      },
    };
    channels.add(channel);
    return channel;
  };
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

const alice = { id: 'u-alice', name: 'Alice', color: '#111111' };
const bob = { id: 'u-bob', name: 'Bob', color: '#222222' };

function tab(
  bus: ReturnType<typeof createBus>,
  storage: ReturnType<typeof memoryStorage>,
  user = alice,
  tabId = 'tab-a',
) {
  const transport = new BroadcastChannelTransport({ boardId: 'demo', user, tabId, createChannel: bus, storage });
  const messages: ServerMessage[] = [];
  transport.onMessage((m) => messages.push(m));
  return { transport, messages };
}

const rename = (id: string, title: string): Op => ({ type: 'board.rename', title, id, clientId: 'c', ts: 0 });

describe('BroadcastChannelTransport', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('seeds the board, persists it and emits a snapshot on connect', () => {
    const storage = memoryStorage();
    const { transport, messages } = tab(createBus(), storage);
    transport.connect();
    expect(transport.status).toBe('connected');
    const snapshot = messages.find((m) => m.type === 'snapshot');
    expect(snapshot?.type === 'snapshot' && snapshot.board.title).toBe('Product Launch');
    expect(storage.data.has(storageKeyForBoard('demo'))).toBe(true);
  });

  it('applies local ops, acks them and syncs them to other tabs', () => {
    const bus = createBus();
    const storage = memoryStorage();
    const a = tab(bus, storage, alice, 'tab-a');
    const b = tab(bus, storage, bob, 'tab-b');
    a.transport.connect();
    b.transport.connect();

    a.transport.sendOp(rename('op-1', 'Renamed in A'));
    expect(a.messages).toContainEqual({ type: 'op', op: rename('op-1', 'Renamed in A'), version: 1 });
    expect(b.messages).toContainEqual({ type: 'op', op: rename('op-1', 'Renamed in A'), version: 1 });

    // A third tab opened later loads the persisted state.
    const c = tab(bus, storage, alice, 'tab-c');
    c.transport.connect();
    const snapshot = c.messages.find((m) => m.type === 'snapshot');
    expect(snapshot?.type === 'snapshot' && snapshot.board.title).toBe('Renamed in A');
  });

  it('rejects ops the reducer cannot apply', () => {
    const { transport, messages } = tab(createBus(), memoryStorage());
    transport.connect();
    transport.sendOp({ type: 'card.delete', cardId: 'ghost', id: 'bad', clientId: 'c', ts: 0 });
    expect(messages.at(-1)).toMatchObject({ type: 'reject', opId: 'bad' });
  });

  it('tracks presence of other tabs, including leaving and timing out', () => {
    const bus = createBus();
    const storage = memoryStorage();
    const a = tab(bus, storage, alice, 'tab-a');
    const b = tab(bus, storage, bob, 'tab-b');
    a.transport.connect();
    b.transport.connect();

    const lastPresence = (messages: ServerMessage[]) =>
      messages.filter((m): m is Extract<ServerMessage, { type: 'presence' }> => m.type === 'presence').at(-1)?.users;

    expect(lastPresence(a.messages)?.map((u) => u.name)).toEqual(['Alice', 'Bob']);
    expect(lastPresence(b.messages)?.map((u) => u.name)).toEqual(['Bob', 'Alice']);

    b.transport.updatePresence({ ...bob, name: 'Robert' });
    expect(lastPresence(a.messages)?.map((u) => u.name)).toEqual(['Alice', 'Robert']);

    b.transport.close();
    expect(lastPresence(a.messages)?.map((u) => u.name)).toEqual(['Alice']);
  });

  it('drops peers that stop sending heartbeats', () => {
    const bus = createBus();
    const storage = memoryStorage();
    const a = tab(bus, storage, alice, 'tab-a');
    a.transport.connect();
    // A peer that says hello once and then vanishes (e.g. crashed tab).
    const ghost = bus('taskflow:demo');
    ghost.postMessage({ kind: 'hello', tabId: 'ghost', user: bob });
    ghost.close();
    vi.advanceTimersByTime(20_000);
    const last = a.messages.filter((m) => m.type === 'presence').at(-1);
    expect(last?.type === 'presence' && last.users.map((u) => u.id)).toEqual(['u-alice']);
  });

  it('ignores malformed peer messages', () => {
    const bus = createBus();
    const a = tab(bus, memoryStorage());
    a.transport.connect();
    const before = a.messages.length;
    const rogue = bus('taskflow:demo');
    rogue.postMessage({ kind: 'op', op: { type: 'card.delete' } });
    rogue.postMessage('nonsense');
    rogue.postMessage({ kind: 'hello', tabId: 'x', user: { id: 1 } });
    expect(a.messages.length).toBe(before);
  });

  it('recovers from corrupt persisted state by reseeding', () => {
    const storage = memoryStorage();
    storage.setItem(storageKeyForBoard('demo'), '{"broken":');
    const { transport, messages } = tab(createBus(), storage);
    transport.connect();
    expect(messages[0]).toMatchObject({ type: 'snapshot', board: { id: 'demo' } });
  });
});
