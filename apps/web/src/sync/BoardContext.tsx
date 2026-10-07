import type { PresenceUser } from '@taskflow/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TAB_ID } from '../lib/id';
import { BoardStoreContext } from './boardStoreContext';
import { BoardStore } from './BoardStore';
import { createTransport } from './createTransport';
import type { SyncTransport } from './transport';

interface BoardProviderProps {
  boardId: string;
  user: PresenceUser;
  children: ReactNode;
  /** Rendered until the store exists. */
  fallback?: ReactNode;
  onReject?: (reason: string) => void;
  /** Override transport creation (tests, Storybook-style demos). */
  transportFactory?: (boardId: string, user: PresenceUser) => SyncTransport;
}

/**
 * Owns the BoardStore for the current board. A new store (and connection) is
 * created whenever the board id changes and torn down on unmount.
 */
export function BoardProvider({
  boardId,
  user,
  children,
  fallback = null,
  onReject,
  transportFactory = createTransport,
}: BoardProviderProps) {
  const [store, setStore] = useState<BoardStore | null>(null);
  const onRejectRef = useRef(onReject);
  useEffect(() => {
    onRejectRef.current = onReject;
  });

  useEffect(() => {
    const next = new BoardStore(transportFactory(boardId, user), {
      clientId: TAB_ID,
      onReject: (reason) => onRejectRef.current?.(reason),
    });
    next.start();
    setStore(next);
    return () => next.destroy();
    // The user is sent separately via updatePresence; reconnecting on rename would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, transportFactory]);

  useEffect(() => {
    store?.updatePresence(user);
  }, [store, user]);

  if (!store) return fallback;
  return <BoardStoreContext value={store}>{children}</BoardStoreContext>;
}
