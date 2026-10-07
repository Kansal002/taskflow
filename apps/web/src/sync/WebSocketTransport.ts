import {
  parseServerMessage,
  type ClientMessage,
  type Op,
  type PresenceUser,
  type ServerMessage,
} from '@taskflow/shared';
import { Emitter, type ConnectionStatus, type SyncTransport } from './transport';

export interface BackoffOptions {
  initialMs: number;
  maxMs: number;
  factor: number;
}

export interface WebSocketTransportOptions {
  url: string;
  boardId: string;
  user: PresenceUser;
  /** Injected for tests; defaults to the global `WebSocket`. */
  WebSocketImpl?: typeof WebSocket;
  backoff?: Partial<BackoffOptions>;
  /** After this many consecutive failed attempts the status reads "offline" (retries continue). */
  offlineAfterAttempts?: number;
  /** Source of randomness for jitter; injectable for deterministic tests. */
  random?: () => number;
  /** Where to listen for `online`/`offline` events. */
  networkEvents?: Pick<Window, 'addEventListener' | 'removeEventListener'> & { navigator?: { onLine: boolean } };
}

const DEFAULT_BACKOFF: BackoffOptions = { initialMs: 500, maxMs: 15_000, factor: 2 };

/**
 * Delay before reconnect attempt `attempt` (1-based): exponential growth,
 * capped, with "equal jitter" (half fixed, half random) so a server restart
 * doesn't get a thundering herd of simultaneous reconnects.
 */
export function backoffDelay(attempt: number, options: BackoffOptions, random: () => number): number {
  const exponential = Math.min(options.maxMs, options.initialMs * options.factor ** Math.max(0, attempt - 1));
  return Math.round(exponential / 2 + (random() * exponential) / 2);
}

/**
 * WebSocket transport with:
 * - automatic reconnect + exponential backoff with jitter
 * - an outbox of un-acknowledged ops that is replayed, in order, after every
 *   (re)connect — the server de-duplicates by op id, so delivery is
 *   effectively exactly-once
 * - browser online/offline awareness
 */
export class WebSocketTransport implements SyncTransport {
  readonly kind = 'websocket' as const;

  private ws: WebSocket | null = null;
  private _status: ConnectionStatus = 'connecting';
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  /** Ops sent (or waiting to be sent) that the server hasn't acknowledged yet. */
  private outbox: Op[] = [];
  private user: PresenceUser;

  private readonly messages = new Emitter<ServerMessage>();
  private readonly statuses = new Emitter<ConnectionStatus>();
  private readonly WS: typeof WebSocket;
  private readonly backoff: BackoffOptions;
  private readonly random: () => number;
  private readonly offlineAfterAttempts: number;
  private readonly network: WebSocketTransportOptions['networkEvents'];

  constructor(private readonly options: WebSocketTransportOptions) {
    this.user = options.user;
    this.WS = options.WebSocketImpl ?? WebSocket;
    this.backoff = { ...DEFAULT_BACKOFF, ...options.backoff };
    this.random = options.random ?? Math.random;
    this.offlineAfterAttempts = options.offlineAfterAttempts ?? 4;
    this.network = options.networkEvents ?? (typeof window !== 'undefined' ? window : undefined);
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  /** Number of ops not yet acknowledged by the server. */
  get pendingCount(): number {
    return this.outbox.length;
  }

  connect(): void {
    if (this.closed) return;
    this.network?.addEventListener('online', this.handleOnline);
    this.network?.addEventListener('offline', this.handleOffline);
    this.open();
  }

  sendOp(op: Op): void {
    this.outbox.push(op);
    this.send({ type: 'op', op });
  }

  updatePresence(user: PresenceUser): void {
    this.user = user;
    this.send({ type: 'presence', user });
  }

  onMessage(listener: (message: ServerMessage) => void): () => void {
    return this.messages.on(listener);
  }

  onStatus(listener: (status: ConnectionStatus) => void): () => void {
    return this.statuses.on(listener);
  }

  close(): void {
    this.closed = true;
    this.clearReconnectTimer();
    this.network?.removeEventListener('online', this.handleOnline);
    this.network?.removeEventListener('offline', this.handleOffline);
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      ws.close(1000, 'Client closed');
    }
    this.messages.clear();
    this.statuses.clear();
  }

  // ---------------------------------------------------------------------------

  private open(): void {
    this.clearReconnectTimer();
    let ws: WebSocket;
    try {
      ws = new this.WS(this.options.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.setStatus('connected');
      ws.send(JSON.stringify({ type: 'join', boardId: this.options.boardId, user: this.user } satisfies ClientMessage));
      // Replay everything the server hasn't acknowledged, in order.
      for (const op of this.outbox) ws.send(JSON.stringify({ type: 'op', op } satisfies ClientMessage));
    };

    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      const message = parseServerMessage(event.data);
      if (!message) return;
      this.settle(message);
      this.messages.emit(message);
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.closed) this.scheduleReconnect();
    };

    // `error` is always followed by `close`, which drives reconnection.
    ws.onerror = () => {};
  }

  /** Removes acknowledged (or rejected) ops from the outbox. */
  private settle(message: ServerMessage): void {
    const opId =
      message.type === 'op' ? message.op.id : message.type === 'ack' || message.type === 'reject' ? message.opId : null;
    if (opId !== null) this.outbox = this.outbox.filter((op) => op.id !== opId);
  }

  private send(message: ClientMessage): void {
    // While disconnected, ops simply stay in the outbox until `onopen` replays them.
    if (this.ws && this.ws.readyState === this.WS.OPEN) this.ws.send(JSON.stringify(message));
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    if (this.isBrowserOffline()) {
      // Don't burn retries while offline; `handleOnline` reconnects immediately.
      this.setStatus('offline');
      return;
    }
    this.attempt += 1;
    this.setStatus(this.attempt > this.offlineAfterAttempts ? 'offline' : 'reconnecting');
    const delay = backoffDelay(this.attempt, this.backoff, this.random);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private isBrowserOffline(): boolean {
    return this.network?.navigator?.onLine === false;
  }

  private readonly handleOnline = () => {
    if (this.closed || this.ws) return;
    this.attempt = 0;
    this.setStatus('reconnecting');
    this.open();
  };

  private readonly handleOffline = () => {
    this.setStatus('offline');
    // Close proactively; the socket would otherwise linger until a timeout.
    this.ws?.close();
  };

  private setStatus(status: ConnectionStatus): void {
    if (status === this._status) return;
    this._status = status;
    this.statuses.emit(status);
  }
}
