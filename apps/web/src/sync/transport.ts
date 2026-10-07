import type { Op, PresenceUser, ServerMessage } from '@taskflow/shared';

/**
 * - `connecting`   first connection attempt in progress
 * - `connected`    live; ops flow both ways
 * - `reconnecting` connection dropped, retrying with backoff (ops are queued)
 * - `offline`      browser is offline or the server has been unreachable for a while
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

/**
 * A sync transport moves ops between this tab and *an authority* that orders
 * them. The board store doesn't know or care which one it is talking to.
 *
 * Implementations:
 * - {@link WebSocketTransport} — remote server; real multi-user collaboration.
 * - {@link BroadcastChannelTransport} — this browser only; an in-tab authority
 *   persists to localStorage and fans ops out to other tabs.
 */
export interface SyncTransport {
  readonly kind: 'websocket' | 'local';
  readonly status: ConnectionStatus;
  /** Start connecting. Messages and status changes are delivered to subscribers. */
  connect(): void;
  /** Queue an op for delivery. Must be delivered at-least-once and in order. */
  sendOp(op: Op): void;
  updatePresence(user: PresenceUser): void;
  onMessage(listener: (message: ServerMessage) => void): () => void;
  onStatus(listener: (status: ConnectionStatus) => void): () => void;
  /** Disconnect permanently and release resources. */
  close(): void;
}

/** Minimal typed event emitter used by the transports. */
export class Emitter<T> {
  private listeners = new Set<(value: T) => void>();

  on(listener: (value: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(value: T): void {
    for (const listener of [...this.listeners]) listener(value);
  }

  clear(): void {
    this.listeners.clear();
  }
}
