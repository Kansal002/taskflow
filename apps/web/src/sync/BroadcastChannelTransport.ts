import {
  createInitialBoard,
  isOp,
  isPresenceUser,
  tryApplyOp,
  type BoardState,
  type Op,
  type PresenceUser,
  type ServerMessage,
} from '@taskflow/shared';
import { Emitter, type ConnectionStatus, type SyncTransport } from './transport';

/** Messages exchanged between tabs over the BroadcastChannel. */
type PeerMessage =
  | { kind: 'op'; op: Op }
  | { kind: 'hello'; tabId: string; user: PresenceUser }
  | { kind: 'here'; tabId: string; user: PresenceUser }
  | { kind: 'bye'; tabId: string };

type ChannelLike = Pick<BroadcastChannel, 'postMessage' | 'close'> & {
  onmessage: ((event: MessageEvent) => void) | null;
};

export interface BroadcastChannelTransportOptions {
  boardId: string;
  user: PresenceUser;
  tabId: string;
  /** Injected for tests. */
  createChannel?: (name: string) => ChannelLike;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  /** How often to announce presence to other tabs. */
  heartbeatMs?: number;
}

export const storageKeyForBoard = (boardId: string) => `taskflow:board:${boardId}`;

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // Accessing localStorage can throw when storage is disabled.
  }
}

function isBoardState(value: unknown): value is BoardState {
  if (typeof value !== 'object' || value === null) return false;
  const board = value as BoardState;
  return (
    typeof board.id === 'string' &&
    typeof board.title === 'string' &&
    typeof board.version === 'number' &&
    typeof board.columns === 'object' &&
    typeof board.cards === 'object' &&
    typeof board.labels === 'object' &&
    typeof board.members === 'object'
  );
}

/**
 * Zero-backend transport used when no `VITE_WS_URL` is configured.
 *
 * Each tab runs a tiny local authority: it applies ops with the shared
 * reducer, persists the board to localStorage, and fans ops out to the
 * other tabs over a BroadcastChannel. Open the app in two tabs and edits
 * appear live in both — which is how the static Netlify demo shows off
 * real-time sync without a server.
 */
export class BroadcastChannelTransport implements SyncTransport {
  readonly kind = 'local' as const;

  private _status: ConnectionStatus = 'connecting';
  private board: BoardState | null = null;
  private channel: ChannelLike | null = null;
  private peers = new Map<string, { user: PresenceUser; lastSeen: number }>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private user: PresenceUser;
  private readonly messages = new Emitter<ServerMessage>();
  private readonly statuses = new Emitter<ConnectionStatus>();
  private readonly heartbeatMs: number;
  private readonly storage: BroadcastChannelTransportOptions['storage'] | null;

  constructor(private readonly options: BroadcastChannelTransportOptions) {
    this.user = options.user;
    this.heartbeatMs = options.heartbeatMs ?? 5_000;
    this.storage = options.storage ?? safeLocalStorage();
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  connect(): void {
    const { boardId } = this.options;
    this.board = this.load() ?? createInitialBoard(boardId);
    this.persist();

    const createChannel =
      this.options.createChannel ??
      ((name: string) => (typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(name)));
    this.channel = createChannel(`taskflow:${boardId}`);
    if (this.channel) this.channel.onmessage = (event) => this.handlePeerMessage(event.data);

    this.post({ kind: 'hello', tabId: this.options.tabId, user: this.user });
    this.heartbeat = setInterval(() => this.tick(), this.heartbeatMs);
    if (typeof window !== 'undefined') window.addEventListener('pagehide', this.handlePageHide);

    this._status = 'connected';
    this.statuses.emit('connected');
    this.messages.emit({ type: 'snapshot', board: this.board });
    this.emitPresence();
  }

  sendOp(op: Op): void {
    if (!this.board) return;
    this.applyAuthoritative(op, true);
  }

  updatePresence(user: PresenceUser): void {
    this.user = user;
    this.post({ kind: 'here', tabId: this.options.tabId, user });
    this.emitPresence();
  }

  onMessage(listener: (message: ServerMessage) => void): () => void {
    return this.messages.on(listener);
  }

  onStatus(listener: (status: ConnectionStatus) => void): () => void {
    return this.statuses.on(listener);
  }

  close(): void {
    this.post({ kind: 'bye', tabId: this.options.tabId });
    if (this.heartbeat !== null) clearInterval(this.heartbeat);
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.handlePageHide);
    if (this.channel) {
      this.channel.onmessage = null;
      this.channel.close();
      this.channel = null;
    }
    this.messages.clear();
    this.statuses.clear();
  }

  // ---------------------------------------------------------------------------

  private applyAuthoritative(op: Op, local: boolean): void {
    if (!this.board) return;
    const result = tryApplyOp(this.board, op);
    if (!result.ok) {
      if (local) this.messages.emit({ type: 'reject', opId: op.id, reason: result.reason });
      return;
    }
    this.board = { ...result.state, version: this.board.version + 1 };
    // Every tab persists, so localStorage always holds the most recent state any tab has seen.
    this.persist();
    if (local) this.post({ kind: 'op', op });
    this.messages.emit({ type: 'op', op, version: this.board.version });
  }

  private handlePeerMessage(data: unknown): void {
    if (typeof data !== 'object' || data === null) return;
    const message = data as PeerMessage;
    switch (message.kind) {
      case 'op':
        if (isOp(message.op)) this.applyAuthoritative(message.op, false);
        return;
      case 'hello':
        if (!isPresenceUser(message.user)) return;
        this.peers.set(message.tabId, { user: message.user, lastSeen: Date.now() });
        // Introduce ourselves to the newcomer.
        this.post({ kind: 'here', tabId: this.options.tabId, user: this.user });
        this.emitPresence();
        return;
      case 'here':
        if (!isPresenceUser(message.user)) return;
        this.peers.set(message.tabId, { user: message.user, lastSeen: Date.now() });
        this.emitPresence();
        return;
      case 'bye':
        if (this.peers.delete(message.tabId)) this.emitPresence();
        return;
    }
  }

  private tick(): void {
    this.post({ kind: 'here', tabId: this.options.tabId, user: this.user });
    const cutoff = Date.now() - this.heartbeatMs * 3;
    let changed = false;
    for (const [tabId, peer] of this.peers) {
      if (peer.lastSeen < cutoff) {
        this.peers.delete(tabId);
        changed = true;
      }
    }
    if (changed) this.emitPresence();
  }

  private emitPresence(): void {
    const byId = new Map<string, PresenceUser>([[this.user.id, this.user]]);
    for (const { user } of this.peers.values()) if (!byId.has(user.id)) byId.set(user.id, user);
    this.messages.emit({ type: 'presence', users: [...byId.values()] });
  }

  private post(message: PeerMessage): void {
    try {
      this.channel?.postMessage(message);
    } catch {
      // Channel closed — nothing to do.
    }
  }

  private load(): BoardState | null {
    try {
      const raw = this.storage?.getItem(storageKeyForBoard(this.options.boardId));
      const value: unknown = raw ? JSON.parse(raw) : null;
      return isBoardState(value) ? value : null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    if (!this.board) return;
    try {
      this.storage?.setItem(storageKeyForBoard(this.options.boardId), JSON.stringify(this.board));
    } catch {
      // Quota exceeded or storage disabled — keep working in memory.
    }
  }

  private readonly handlePageHide = () => {
    this.post({ kind: 'bye', tabId: this.options.tabId });
  };
}
