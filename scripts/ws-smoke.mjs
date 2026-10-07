#!/usr/bin/env node
/**
 * End-to-end smoke test for the sync server.
 *
 * Starts the *built* server (apps/server/dist) as a real child process, opens
 * two WebSocket clients on the same board, sends an op from one and asserts
 * the other receives it, then shuts the server down.
 *
 *   npm run build -w @taskflow/server && npm run smoke:ws
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';

const PORT = Number(process.env.SMOKE_PORT ?? 8899);
const HTTP = `http://127.0.0.1:${PORT}`;
const WS_URL = `ws://127.0.0.1:${PORT}`;
const BOARD = `smoke-${Date.now().toString(36)}`;

const server = spawn(process.execPath, ['apps/server/dist/index.js'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
server.stdout.on('data', (chunk) => process.stdout.write(`  [server] ${chunk}`));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
};

function client(name, color) {
  const ws = new WebSocket(WS_URL);
  const inbox = [];
  const waiters = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    inbox.push(msg);
    for (const waiter of [...waiters]) {
      if (!waiter.match(msg)) continue;
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(msg);
    }
  });
  return {
    ws,
    user: { id: `user-${name}`, name, color },
    send: (msg) => ws.send(JSON.stringify(msg)),
    next: (match, timeoutMs = 3000) => {
      const found = inbox.find(match);
      if (found) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${name}: timed out`)), timeoutMs);
        waiters.push({
          match,
          resolve: (m) => {
            clearTimeout(timer);
            resolve(m);
          },
        });
      });
    },
  };
}

async function waitForHealth() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${HTTP}/health`);
      if (res.ok) return res.json();
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Server did not become healthy');
}

let exitCode = 0;
try {
  const health = await waitForHealth();
  check('GET /health', health.status === 'ok', JSON.stringify(health));

  const alice = client('Alice', '#4f46e5');
  const bob = client('Bob', '#dc2626');
  await Promise.all([once(alice.ws, 'open'), once(bob.ws, 'open')]);

  alice.send({ type: 'join', boardId: BOARD, user: alice.user });
  bob.send({ type: 'join', boardId: BOARD, user: bob.user });
  const [snapA, snapB] = await Promise.all([
    alice.next((m) => m.type === 'snapshot'),
    bob.next((m) => m.type === 'snapshot'),
  ]);
  check('both clients receive a snapshot on join', snapA.board.id === BOARD && snapB.board.id === BOARD);

  const presence = await alice.next((m) => m.type === 'presence' && m.users.length === 2);
  check('presence lists both users', true, presence.users.map((u) => u.name).join(', '));

  const op = {
    type: 'card.create',
    id: `op-${Date.now()}`,
    clientId: 'smoke-alice',
    ts: Date.now(),
    card: {
      id: 'smoke-card',
      columnId: 'col-todo',
      order: 'V',
      title: 'Hello from Alice',
      description: '',
      labelIds: [],
      priority: 'high',
      assigneeId: null,
      dueDate: null,
      checklist: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };
  const t0 = performance.now();
  alice.send({ type: 'op', op });
  const received = await bob.next((m) => m.type === 'op' && m.op.id === op.id);
  const latency = (performance.now() - t0).toFixed(1);
  check(
    'Bob receives the op Alice sent',
    received.op.card.title === 'Hello from Alice' && received.version === snapB.board.version + 1,
    `version ${received.version}, ${latency} ms round trip on localhost`,
  );
  const ack = await alice.next((m) => m.type === 'op' && m.op.id === op.id);
  check('Alice gets the broadcast back as her ack', ack.version === received.version);

  alice.send({ type: 'op', op });
  const dup = await alice.next((m) => m.type === 'ack' && m.opId === op.id);
  check('re-sent op is de-duplicated (ack, no re-broadcast)', dup.version === received.version);

  const carol = client('Carol', '#16a34a');
  await once(carol.ws, 'open');
  carol.send({ type: 'join', boardId: BOARD, user: carol.user });
  const late = await carol.next((m) => m.type === 'snapshot');
  check('late joiner snapshot contains the new card', late.board.cards['smoke-card']?.title === 'Hello from Alice');

  for (const c of [alice, bob, carol]) c.ws.close();
} catch (error) {
  check('smoke test', false, error instanceof Error ? error.message : String(error));
} finally {
  server.kill('SIGTERM');
  await once(server, 'exit');
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed; server stopped.`);
  exitCode = failed ? 1 : 0;
}
process.exit(exitCode);
