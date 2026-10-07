import { createInitialBoard, tryApplyOp, type BoardState, type Op, type PresenceUser } from '@taskflow/shared';

/** How many recent op ids each room remembers for de-duplication. */
const DEDUPE_WINDOW = 1_000;

export type ApplyOutcome =
  { kind: 'applied'; version: number } | { kind: 'duplicate'; version: number } | { kind: 'rejected'; reason: string };

/**
 * One board's authoritative state plus the set of connected clients.
 *
 * Generic over the connection type so the room logic can be unit-tested
 * without real sockets.
 */
export class Room<Conn> {
  readonly id: string;
  private state: BoardState;
  private readonly members = new Map<Conn, PresenceUser>();
  private readonly seenOpIds = new Set<string>();
  lastActiveAt = Date.now();

  constructor(id: string, initial: BoardState = createInitialBoard(id)) {
    this.id = id;
    this.state = initial;
  }

  get snapshot(): BoardState {
    return this.state;
  }

  get size(): number {
    return this.members.size;
  }

  get connections(): IterableIterator<Conn> {
    return this.members.keys();
  }

  join(conn: Conn, user: PresenceUser): void {
    this.members.set(conn, user);
    this.touch();
  }

  updatePresence(conn: Conn, user: PresenceUser): boolean {
    if (!this.members.has(conn)) return false;
    this.members.set(conn, user);
    return true;
  }

  leave(conn: Conn): boolean {
    const removed = this.members.delete(conn);
    this.touch();
    return removed;
  }

  /** Unique users in the room (one user may have several tabs open). */
  presence(): PresenceUser[] {
    const byId = new Map<string, PresenceUser>();
    for (const user of this.members.values()) byId.set(user.id, user);
    return [...byId.values()];
  }

  /**
   * Applies an op through the shared reducer. The server is the single
   * source of truth for ordering: every applied op gets the next version.
   */
  apply(op: Op): ApplyOutcome {
    this.touch();
    if (this.seenOpIds.has(op.id)) {
      // A client re-sent an op after reconnecting, but we already applied it.
      return { kind: 'duplicate', version: this.state.version };
    }
    const result = tryApplyOp(this.state, op);
    if (!result.ok) return { kind: 'rejected', reason: result.reason };

    this.state = { ...result.state, version: this.state.version + 1 };
    this.remember(op.id);
    return { kind: 'applied', version: this.state.version };
  }

  private remember(opId: string): void {
    this.seenOpIds.add(opId);
    if (this.seenOpIds.size > DEDUPE_WINDOW) {
      // Sets iterate in insertion order, so the first entry is the oldest.
      const oldest = this.seenOpIds.values().next().value;
      if (oldest !== undefined) this.seenOpIds.delete(oldest);
    }
  }

  private touch(): void {
    this.lastActiveAt = Date.now();
  }
}

/** Holds every room in memory, evicting the least-recently-active empty rooms past a cap. */
export class RoomRegistry<Conn> {
  private readonly rooms = new Map<string, Room<Conn>>();

  constructor(private readonly maxRooms = 500) {}

  get size(): number {
    return this.rooms.size;
  }

  get(boardId: string): Room<Conn> | undefined {
    return this.rooms.get(boardId);
  }

  getOrCreate(boardId: string): Room<Conn> {
    let room = this.rooms.get(boardId);
    if (!room) {
      this.evictIfNeeded();
      room = new Room<Conn>(boardId);
      this.rooms.set(boardId, room);
    }
    return room;
  }

  connectionCount(): number {
    let total = 0;
    for (const room of this.rooms.values()) total += room.size;
    return total;
  }

  private evictIfNeeded(): void {
    if (this.rooms.size < this.maxRooms) return;
    const empty = [...this.rooms.values()]
      .filter((room) => room.size === 0)
      .sort((a, b) => a.lastActiveAt - b.lastActiveAt);
    const victim = empty[0];
    if (victim) this.rooms.delete(victim.id);
  }
}
