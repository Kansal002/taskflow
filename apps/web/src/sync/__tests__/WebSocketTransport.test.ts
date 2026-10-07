import type { Op } from '@taskflow/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockWebSocket } from '../../test/MockWebSocket';
import type { ConnectionStatus } from '../transport';
import { backoffDelay, WebSocketTransport } from '../WebSocketTransport';

const user = { id: 'u1', name: 'Ada', color: '#123456' };

function op(id: string): Op {
  return { type: 'board.rename', title: id, id, clientId: 'tab', ts: 0 };
}

function makeNetwork(onLine = true) {
  const target = new EventTarget();
  return Object.assign(target, { navigator: { onLine } });
}

function setup(options: { network?: ReturnType<typeof makeNetwork> } = {}) {
  const network = options.network ?? makeNetwork();
  const transport = new WebSocketTransport({
    url: 'ws://test',
    boardId: 'demo',
    user,
    WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    backoff: { initialMs: 100, maxMs: 1_000, factor: 2 },
    random: () => 1, // no jitter → deterministic delays
    offlineAfterAttempts: 3,
    networkEvents: network,
  });
  const statuses: ConnectionStatus[] = [];
  transport.onStatus((s) => statuses.push(s));
  const messages: unknown[] = [];
  transport.onMessage((m) => messages.push(m));
  return { transport, statuses, messages, network };
}

describe('backoffDelay', () => {
  const opts = { initialMs: 500, maxMs: 15_000, factor: 2 };

  it('grows exponentially and caps at maxMs', () => {
    const delays = [1, 2, 3, 4, 5, 6, 7].map((n) => backoffDelay(n, opts, () => 1));
    expect(delays).toEqual([500, 1000, 2000, 4000, 8000, 15000, 15000]);
  });

  it('applies equal jitter (between 50% and 100% of the exponential delay)', () => {
    expect(backoffDelay(3, opts, () => 0)).toBe(1000);
    expect(backoffDelay(3, opts, () => 0.5)).toBe(1500);
  });
});

describe('WebSocketTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('joins the board as soon as the socket opens', () => {
    const { transport, statuses } = setup();
    transport.connect();
    expect(transport.status).toBe('connecting');
    MockWebSocket.latest.open();
    expect(statuses).toEqual(['connected']);
    expect(MockWebSocket.latest.sent[0]).toEqual({ type: 'join', boardId: 'demo', user });
  });

  it('forwards parsed server messages and ignores garbage', () => {
    const { transport, messages } = setup();
    transport.connect();
    MockWebSocket.latest.open();
    MockWebSocket.latest.receive({ type: 'presence', users: [user] });
    MockWebSocket.latest.onmessage?.({ data: 'not json' } as MessageEvent);
    expect(messages).toEqual([{ type: 'presence', users: [user] }]);
  });

  it('queues ops while connecting and flushes them after join, in order', () => {
    const { transport } = setup();
    transport.connect();
    transport.sendOp(op('a'));
    transport.sendOp(op('b'));
    expect(MockWebSocket.latest.sent).toEqual([]);
    MockWebSocket.latest.open();
    expect(MockWebSocket.latest.sent.map((m) => (m as { type: string }).type)).toEqual(['join', 'op', 'op']);
    expect(MockWebSocket.latest.sentOfType('op')).toEqual([
      { type: 'op', op: op('a') },
      { type: 'op', op: op('b') },
    ]);
  });

  it('reconnects with exponential backoff and reports status', () => {
    const { transport, statuses } = setup();
    transport.connect();
    MockWebSocket.latest.open();

    MockWebSocket.latest.drop();
    expect(transport.status).toBe('reconnecting');
    expect(MockWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(99);
    expect(MockWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(2); // attempt 1 after 100ms

    MockWebSocket.latest.drop();
    vi.advanceTimersByTime(199);
    expect(MockWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(3); // attempt 2 after 200ms

    MockWebSocket.latest.open();
    expect(transport.status).toBe('connected');
    expect(statuses).toEqual(['connected', 'reconnecting', 'connected']);
  });

  it('reports "offline" after repeated failures but keeps retrying', () => {
    const { transport } = setup();
    transport.connect();
    for (let attempt = 1; attempt <= 4; attempt++) {
      MockWebSocket.latest.drop();
      vi.runOnlyPendingTimers();
    }
    expect(transport.status).toBe('offline');
    const before = MockWebSocket.instances.length;
    MockWebSocket.latest.drop();
    vi.runOnlyPendingTimers();
    expect(MockWebSocket.instances.length).toBe(before + 1);
    MockWebSocket.latest.open();
    expect(transport.status).toBe('connected');
  });

  it('replays un-acknowledged ops after reconnecting and drops acknowledged ones', () => {
    const { transport } = setup();
    transport.connect();
    const first = MockWebSocket.latest;
    first.open();

    transport.sendOp(op('acked'));
    transport.sendOp(op('in-flight'));
    first.receive({ type: 'op', op: op('acked'), version: 1 }); // broadcast echo = ack
    expect(transport.pendingCount).toBe(1);

    first.drop();
    transport.sendOp(op('offline-1')); // made while disconnected
    vi.advanceTimersByTime(100);

    const second = MockWebSocket.latest;
    expect(second).not.toBe(first);
    second.open();
    expect(second.sentOfType('op').map((m) => (m as { op: Op }).op.id)).toEqual(['in-flight', 'offline-1']);

    second.receive({ type: 'ack', opId: 'in-flight', version: 2 });
    second.receive({ type: 'reject', opId: 'offline-1', reason: 'nope' });
    expect(transport.pendingCount).toBe(0);
  });

  it('waits for the browser to come back online instead of retrying blindly', () => {
    const network = makeNetwork(true);
    const { transport } = setup({ network });
    transport.connect();
    MockWebSocket.latest.open();

    network.navigator.onLine = false;
    network.dispatchEvent(new Event('offline'));
    expect(transport.status).toBe('offline');

    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances).toHaveLength(1); // no retries while offline

    network.navigator.onLine = true;
    network.dispatchEvent(new Event('online'));
    expect(MockWebSocket.instances).toHaveLength(2); // immediate reconnect
    expect(transport.status).toBe('reconnecting');
    MockWebSocket.latest.open();
    expect(transport.status).toBe('connected');
  });

  it('sends presence updates only while connected', () => {
    const { transport } = setup();
    transport.connect();
    transport.updatePresence({ ...user, name: 'Early' });
    MockWebSocket.latest.open();
    // The join carries the latest user, so nothing was lost.
    expect(MockWebSocket.latest.sent[0]).toMatchObject({ type: 'join', user: { name: 'Early' } });
    transport.updatePresence({ ...user, name: 'Later' });
    expect(MockWebSocket.latest.sentOfType('presence')).toEqual([
      { type: 'presence', user: { ...user, name: 'Later' } },
    ]);
  });

  it('close() stops reconnecting and detaches listeners', () => {
    const { transport, network } = setup();
    transport.connect();
    MockWebSocket.latest.open();
    MockWebSocket.latest.drop();
    transport.close();
    vi.advanceTimersByTime(10_000);
    expect(MockWebSocket.instances).toHaveLength(1);
    network.dispatchEvent(new Event('online'));
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('retries when the WebSocket constructor throws', () => {
    let calls = 0;
    const Throwing = function (this: unknown, url: string) {
      calls += 1;
      if (calls === 1) throw new Error('bad url');
      return new MockWebSocket(url);
    } as unknown as typeof WebSocket;
    Object.assign(Throwing, { OPEN: 1 });
    const transport = new WebSocketTransport({
      url: 'ws://x',
      boardId: 'demo',
      user,
      WebSocketImpl: Throwing,
      random: () => 1,
      backoff: { initialMs: 10 },
      networkEvents: makeNetwork(),
    });
    transport.connect();
    expect(transport.status).toBe('reconnecting');
    vi.advanceTimersByTime(10);
    expect(calls).toBe(2);
  });
});
