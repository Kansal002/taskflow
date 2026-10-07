import type { ClientMessage, Op, PresenceUser, ServerMessage } from '@taskflow/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { startSyncServer, type SyncServer } from '../server';

/** Thin test client that records every message and lets tests await specific ones. */
class TestClient {
  readonly messages: ServerMessage[] = [];
  private waiters: { match: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];

  private constructor(readonly ws: WebSocket) {
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      this.messages.push(message);
      this.waiters = this.waiters.filter((w) => {
        if (!w.match(message)) return true;
        w.resolve(message);
        return false;
      });
    });
  }

  static async connect(port: number, headers: Record<string, string> = {}): Promise<TestClient> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, { headers });
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    return new TestClient(ws);
  }

  send(message: ClientMessage | Record<string, unknown>): void {
    this.ws.send(JSON.stringify(message));
  }

  next<T extends ServerMessage['type']>(
    type: T,
    where: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const match = (m: ServerMessage) => m.type === type && where(m as Extract<ServerMessage, { type: T }>);
    const existing = this.messages.find(match);
    if (existing) {
      this.messages.splice(this.messages.indexOf(existing), 1);
      return Promise.resolve(existing as Extract<ServerMessage, { type: T }>);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${type}"`)), 2000);
      this.waiters.push({
        match,
        resolve: (m) => {
          clearTimeout(timer);
          this.messages.splice(this.messages.indexOf(m), 1);
          resolve(m as Extract<ServerMessage, { type: T }>);
        },
      });
    });
  }

  close(): void {
    this.ws.close();
  }
}

const alice: PresenceUser = { id: 'u-alice', name: 'Alice', color: '#ff0000' };
const bob: PresenceUser = { id: 'u-bob', name: 'Bob', color: '#00ff00' };

function renameOp(id: string, title: string): Op {
  return { type: 'card.update', cardId: 'card-1', patch: { title }, id, clientId: 'test', ts: Date.now() };
}

describe('sync server', () => {
  let server: SyncServer;

  beforeEach(async () => {
    server = await startSyncServer({ port: 0, host: '127.0.0.1' });
  });

  afterEach(async () => {
    await server.close();
  });

  it('serves /health', async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', rooms: 0, connections: 0 });
  });

  it('sends a full snapshot on join', async () => {
    const client = await TestClient.connect(server.port);
    client.send({ type: 'join', boardId: 'demo', user: alice });
    const snapshot = await client.next('snapshot');
    expect(snapshot.board.id).toBe('demo');
    expect(snapshot.board.title).toBe('Product Launch');
    expect(Object.keys(snapshot.board.columns)).toHaveLength(4);
    client.close();
  });

  it('broadcasts ops to everyone in the room with increasing versions', async () => {
    const a = await TestClient.connect(server.port);
    const b = await TestClient.connect(server.port);
    a.send({ type: 'join', boardId: 'room-1', user: alice });
    b.send({ type: 'join', boardId: 'room-1', user: bob });
    await a.next('snapshot');
    await b.next('snapshot');

    a.send({
      type: 'op',
      op: { type: 'board.rename', title: 'Sprint 12', id: 'op-1', clientId: 'a', ts: Date.now() },
    });
    const received = await b.next('op');
    const echoed = await a.next('op'); // echo to the sender is its ack
    expect(received.op.id).toBe('op-1');
    expect(received.version).toBe(1);
    expect(echoed.version).toBe(1);

    a.send({ type: 'op', op: { type: 'board.rename', title: 'Sprint 13', id: 'op-2', clientId: 'a', ts: Date.now() } });
    expect((await b.next('op')).version).toBe(2);

    // A late joiner gets the up-to-date snapshot.
    const c = await TestClient.connect(server.port);
    c.send({ type: 'join', boardId: 'room-1', user: { ...bob, id: 'u-carol' } });
    const snapshot = await c.next('snapshot');
    expect(snapshot.board.title).toBe('Sprint 13');
    expect(snapshot.board.version).toBe(2);

    [a, b, c].forEach((client) => client.close());
  });

  it('isolates rooms from each other', async () => {
    const a = await TestClient.connect(server.port);
    const b = await TestClient.connect(server.port);
    a.send({ type: 'join', boardId: 'room-a', user: alice });
    b.send({ type: 'join', boardId: 'room-b', user: bob });
    await a.next('snapshot');
    await b.next('snapshot');
    a.send({ type: 'op', op: { type: 'board.rename', title: 'A only', id: 'op-a', clientId: 'a', ts: 1 } });
    await a.next('op');
    await new Promise((r) => setTimeout(r, 50));
    expect(b.messages.some((m) => m.type === 'op')).toBe(false);
    a.close();
    b.close();
  });

  it('de-duplicates re-sent ops and rejects invalid ones', async () => {
    const a = await TestClient.connect(server.port);
    a.send({ type: 'join', boardId: 'demo', user: alice });
    await a.next('snapshot');

    a.send({ type: 'op', op: renameOp('dup-1', 'Once') });
    expect((await a.next('op')).version).toBe(1);
    a.send({ type: 'op', op: renameOp('dup-1', 'Once') });
    const ack = await a.next('ack');
    expect(ack).toEqual({ type: 'ack', opId: 'dup-1', version: 1 });

    a.send({ type: 'op', op: { type: 'card.delete', cardId: 'ghost', id: 'bad-1', clientId: 'a', ts: 1 } });
    const reject = await a.next('reject');
    expect(reject.opId).toBe('bad-1');

    a.send({ type: 'op', op: { type: 'card.delete' } });
    expect((await a.next('error')).message).toMatch(/malformed/i);
    a.close();
  });

  it('broadcasts presence on join and leave', async () => {
    const a = await TestClient.connect(server.port);
    const b = await TestClient.connect(server.port);
    a.send({ type: 'join', boardId: 'demo', user: alice });
    await a.next('presence', (m) => m.users.length === 1);
    b.send({ type: 'join', boardId: 'demo', user: bob });
    const both = await a.next('presence', (m) => m.users.length === 2);
    expect(both.users.map((u) => u.name).sort()).toEqual(['Alice', 'Bob']);

    b.send({ type: 'presence', user: { ...bob, name: 'Robert' } });
    const renamed = await a.next('presence', (m) => m.users.some((u) => u.name === 'Robert'));
    expect(renamed.users).toHaveLength(2);

    b.close();
    const alone = await a.next('presence', (m) => m.users.length === 1);
    expect(alone.users[0]?.name).toBe('Alice');
    a.close();
  });

  it('rejects ops sent before joining', async () => {
    const a = await TestClient.connect(server.port);
    a.send({ type: 'op', op: renameOp('early', 'x') });
    expect((await a.next('reject')).reason).toMatch(/join/i);
    a.close();
  });
});

describe('origin allow-list', () => {
  it('refuses upgrades from unknown origins', async () => {
    const server = await startSyncServer({ port: 0, host: '127.0.0.1', allowedOrigins: ['https://ok.example'] });
    await expect(TestClient.connect(server.port, { origin: 'https://evil.example' })).rejects.toThrow();
    const ok = await TestClient.connect(server.port, { origin: 'https://ok.example' });
    ok.close();
    await server.close();
  });
});
