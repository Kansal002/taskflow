import {
  applyOps,
  invertOp,
  tryApplyOp,
  withMeta,
  type BoardState,
  type Op,
  type OpPayload,
  type PresenceUser,
  type ServerMessage,
} from '@taskflow/shared';
import { createId } from '../lib/id';
import type { ConnectionStatus, SyncTransport } from './transport';

export interface BoardSnapshot {
  /** What the UI renders: the server-confirmed state with pending local ops replayed on top. */
  board: BoardState | null;
  status: ConnectionStatus;
  transportKind: SyncTransport['kind'];
  presence: PresenceUser[];
  /** Local ops not yet acknowledged by the authority. */
  pendingCount: number;
  canUndo: boolean;
}

export interface BoardStoreOptions {
  clientId: string;
  /** Called when the authority rejects one of our ops (it has already been rolled back). */
  onReject?: (reason: string, op: Op) => void;
  maxUndo?: number;
}

/**
 * Client-side state for one board, implementing optimistic updates with
 * server reconciliation ("rebase pending ops on confirmed state"):
 *
 *   view = confirmed ⊕ pending₁ ⊕ pending₂ ⊕ …
 *
 * - `dispatch` applies an op to the view immediately and hands it to the
 *   transport.
 * - When the authority broadcasts an op, it is applied to `confirmed`. If it
 *   is one of ours, it is also dropped from `pending` (that is the ack).
 * - A `snapshot` replaces `confirmed` wholesale (on join / reconnect); pending
 *   ops are replayed on top, so nothing typed while offline is lost.
 * - A `reject` drops the op from `pending`, which rolls the view back.
 *
 * Because every replica runs the same pure reducer in the same (server)
 * order, all clients converge.
 *
 * Exposes a `subscribe`/`getSnapshot` pair for `useSyncExternalStore`.
 */
export class BoardStore {
  private confirmed: BoardState | null = null;
  private pending: Op[] = [];
  private presence: PresenceUser[] = [];
  private undoStack: OpPayload[][] = [];
  private snapshot: BoardSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribers: (() => void)[] = [];

  constructor(
    private readonly transport: SyncTransport,
    private readonly options: BoardStoreOptions,
  ) {
    this.snapshot = this.buildSnapshot(null);
    this.unsubscribers.push(
      transport.onMessage((message) => this.handleMessage(message)),
      transport.onStatus(() => this.publish(this.snapshot.board)),
    );
  }

  /** Starts the transport. Separate from the constructor so listeners attach first. */
  start(): void {
    this.transport.connect();
  }

  destroy(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.transport.close();
    this.listeners.clear();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): BoardSnapshot => this.snapshot;

  /**
   * Applies `payloads` optimistically as a single user action.
   * Returns false if nothing could be applied (e.g. the target was deleted).
   */
  dispatch(payloads: OpPayload | OpPayload[], { undoable = true }: { undoable?: boolean } = {}): boolean {
    const list = Array.isArray(payloads) ? payloads : [payloads];
    let view = this.snapshot.board;
    if (!view) return false;

    const ops: Op[] = [];
    const inverse: OpPayload[] = [];
    for (const payload of list) {
      const op = withMeta(payload, { id: createId('op'), clientId: this.options.clientId, ts: Date.now() });
      const result = tryApplyOp(view, op);
      if (!result.ok) continue;
      // Inverses are prepended so undo replays them in reverse order.
      inverse.unshift(...invertOp(view, payload));
      view = result.state;
      ops.push(op);
    }
    if (ops.length === 0) return false;

    if (undoable && inverse.length > 0) {
      this.undoStack.push(inverse);
      const max = this.options.maxUndo ?? 50;
      if (this.undoStack.length > max) this.undoStack.shift();
    }
    this.pending.push(...ops);
    this.publish(view);
    for (const op of ops) this.transport.sendOp(op);
    return true;
  }

  /** Reverts this client's most recent action. */
  undo(): boolean {
    const inverse = this.undoStack.pop();
    if (!inverse) return false;
    const applied = this.dispatch(inverse, { undoable: false });
    if (!applied) this.publish(this.snapshot.board); // keep canUndo in sync
    return applied;
  }

  updatePresence(user: PresenceUser): void {
    this.transport.updatePresence(user);
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'snapshot':
        this.confirmed = message.board;
        this.rebase();
        return;
      case 'op': {
        if (!this.confirmed) return;
        const result = tryApplyOp(this.confirmed, message.op);
        if (result.ok) this.confirmed = { ...result.state, version: message.version };
        this.pending = this.pending.filter((op) => op.id !== message.op.id);
        this.rebase();
        return;
      }
      case 'ack':
        this.pending = this.pending.filter((op) => op.id !== message.opId);
        this.rebase();
        return;
      case 'reject': {
        const rejected = this.pending.find((op) => op.id === message.opId);
        this.pending = this.pending.filter((op) => op.id !== message.opId);
        this.rebase();
        if (rejected) this.options.onReject?.(message.reason, rejected);
        return;
      }
      case 'presence':
        this.presence = message.users;
        this.publish(this.snapshot.board);
        return;
      case 'error':
        return;
    }
  }

  private rebase(): void {
    this.publish(this.confirmed ? applyOps(this.confirmed, this.pending) : null);
  }

  private buildSnapshot(board: BoardState | null): BoardSnapshot {
    return {
      board,
      status: this.transport.status,
      transportKind: this.transport.kind,
      presence: this.presence,
      pendingCount: this.pending.length,
      canUndo: this.undoStack.length > 0,
    };
  }

  private publish(board: BoardState | null): void {
    this.snapshot = this.buildSnapshot(board);
    for (const listener of [...this.listeners]) listener();
  }
}
