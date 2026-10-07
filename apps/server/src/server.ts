import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { parseClientMessage, type ClientMessage, type ServerMessage } from '@taskflow/shared';
import { WebSocket, WebSocketServer } from 'ws';
import { RoomRegistry, type Room } from './room';

export interface SyncServerOptions {
  port?: number;
  host?: string;
  /** Allowed `Origin` headers for WebSocket upgrades. Empty = allow all. */
  allowedOrigins?: string[];
  /** Interval for ping/pong liveness checks. */
  heartbeatMs?: number;
  /** Max messages per client per second before the socket is closed. */
  maxMessagesPerSecond?: number;
  maxRooms?: number;
  log?: (message: string) => void;
}

export interface SyncServer {
  http: Server;
  wss: WebSocketServer;
  rooms: RoomRegistry<WebSocket>;
  port: number;
  close: () => Promise<void>;
}

interface ClientState {
  room: Room<WebSocket> | null;
  alive: boolean;
  windowStart: number;
  messagesInWindow: number;
}

const MAX_PAYLOAD_BYTES = 128 * 1024;

export async function startSyncServer(options: SyncServerOptions = {}): Promise<SyncServer> {
  const {
    port = 8787,
    host,
    allowedOrigins = [],
    heartbeatMs = 30_000,
    maxMessagesPerSecond = 60,
    maxRooms = 500,
    log = () => {},
  } = options;

  const rooms = new RoomRegistry<WebSocket>(maxRooms);
  const clients = new Map<WebSocket, ClientState>();
  const startedAt = Date.now();

  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') {
      sendJson(res, 200, {
        status: 'ok',
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        rooms: rooms.size,
        connections: clients.size,
      });
      return;
    }
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('TaskFlow sync server. Connect over WebSocket; see /health for status.\n');
      return;
    }
    sendJson(res, 404, { error: 'Not found' });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });

  http.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin;
    if (allowedOrigins.length > 0 && (!origin || !allowedOrigins.includes(origin))) {
      log(`Rejected upgrade from origin ${origin ?? '<none>'}`);
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket) => {
    const state: ClientState = { room: null, alive: true, windowStart: Date.now(), messagesInWindow: 0 };
    clients.set(ws, state);

    ws.on('pong', () => {
      state.alive = true;
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) return send(ws, { type: 'error', message: 'Binary frames are not supported' });
      if (isRateLimited(state)) {
        ws.close(1008, 'Rate limit exceeded');
        return;
      }
      const message = parseClientMessage(data.toString());
      if (!message) return send(ws, { type: 'error', message: 'Malformed message' });
      handleMessage(ws, state, message);
    });

    ws.on('close', () => {
      clients.delete(ws);
      const room = state.room;
      if (room && room.leave(ws)) broadcastPresence(room);
    });

    ws.on('error', (err) => log(`Socket error: ${err.message}`));
  });

  function handleMessage(ws: WebSocket, state: ClientState, message: ClientMessage): void {
    switch (message.type) {
      case 'join': {
        if (state.room) {
          state.room.leave(ws);
          broadcastPresence(state.room);
        }
        const room = rooms.getOrCreate(message.boardId);
        room.join(ws, message.user);
        state.room = room;
        send(ws, { type: 'snapshot', board: room.snapshot });
        broadcastPresence(room);
        log(`${message.user.name} joined ${room.id} (${room.size} connected)`);
        return;
      }
      case 'presence': {
        if (state.room?.updatePresence(ws, message.user)) broadcastPresence(state.room);
        return;
      }
      case 'op': {
        const room = state.room;
        if (!room) return send(ws, { type: 'reject', opId: message.op.id, reason: 'Join a board first' });
        const outcome = room.apply(message.op);
        if (outcome.kind === 'applied') {
          // Broadcast to everyone, including the sender — for the sender it is the ack.
          broadcast(room, { type: 'op', op: message.op, version: outcome.version });
        } else if (outcome.kind === 'duplicate') {
          send(ws, { type: 'ack', opId: message.op.id, version: outcome.version });
        } else {
          send(ws, { type: 'reject', opId: message.op.id, reason: outcome.reason });
        }
        return;
      }
    }
  }

  function isRateLimited(state: ClientState): boolean {
    const now = Date.now();
    if (now - state.windowStart >= 1000) {
      state.windowStart = now;
      state.messagesInWindow = 0;
    }
    state.messagesInWindow += 1;
    return state.messagesInWindow > maxMessagesPerSecond;
  }

  function broadcastPresence(room: Room<WebSocket>): void {
    broadcast(room, { type: 'presence', users: room.presence() });
  }

  function broadcast(room: Room<WebSocket>, message: ServerMessage): void {
    const frame = JSON.stringify(message);
    for (const conn of room.connections) {
      if (conn.readyState === WebSocket.OPEN) conn.send(frame);
    }
  }

  // Liveness: terminate sockets that stop answering pings (e.g. a laptop lid closing).
  const heartbeat = setInterval(() => {
    for (const [ws, state] of clients) {
      if (!state.alive) {
        ws.terminate();
        continue;
      }
      state.alive = false;
      ws.ping();
    }
  }, heartbeatMs);
  heartbeat.unref();

  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(port, host, () => {
      http.off('error', reject);
      resolve();
    });
  });

  const actualPort = (http.address() as AddressInfo).port;

  return {
    http,
    wss,
    rooms,
    port: actualPort,
    close: async () => {
      clearInterval(heartbeat);
      for (const ws of clients.keys()) ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve, reject) => http.close((err) => (err ? reject(err) : resolve())));
    },
  };
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify(body));
}
