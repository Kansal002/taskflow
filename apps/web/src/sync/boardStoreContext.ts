import { createContext, use, useSyncExternalStore } from 'react';
import type { BoardSnapshot, BoardStore } from './BoardStore';

export const BoardStoreContext = createContext<BoardStore | null>(null);

export function useBoardStore(): BoardStore {
  const store = use(BoardStoreContext);
  if (!store) throw new Error('useBoardStore must be used inside <BoardProvider>');
  return store;
}

export function useBoardSnapshot(): BoardSnapshot {
  const store = useBoardStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
