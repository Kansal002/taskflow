import { isValidBoardId, type PresenceUser } from '@taskflow/shared';
import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useToast } from '../components/ui';
import { Board } from '../features/board/Board';
import { InlineEdit } from '../features/board/InlineEdit';
import { useBoardActions } from '../features/board/useBoardActions';
import { CardDialog } from '../features/card/CardDialog';
import { FilterBar } from '../features/filters/FilterBar';
import { filterCards } from '../features/filters/filterCards';
import { useFilters } from '../features/filters/useFilters';
import { AppHeader } from '../features/header/AppHeader';
import { createBoardId } from '../lib/id';
import { getRecentBoards, rememberBoard } from '../lib/recentBoards';
import { useHotkey } from '../lib/useHotkey';
import { BoardProvider } from '../sync/BoardContext';
import { useBoardSnapshot, useBoardStore } from '../sync/boardStoreContext';
import { BoardSkeleton } from './BoardSkeleton';
import { NotFound } from './NotFound';

interface BoardPageProps {
  user: PresenceUser;
  onUserChange: (user: PresenceUser) => void;
}

export function BoardPage({ user, onUserChange }: BoardPageProps) {
  const { boardId } = useParams();
  const { toast } = useToast();

  const onReject = useCallback(
    (reason: string) => toast({ title: 'A change could not be applied', description: reason, variant: 'error' }),
    [toast],
  );

  if (!isValidBoardId(boardId)) return <NotFound />;

  return (
    // Keyed by board id: switching boards tears down the old connection and store.
    <BoardProvider key={boardId} boardId={boardId} user={user} onReject={onReject} fallback={<BoardSkeleton />}>
      <BoardScreen boardId={boardId} user={user} onUserChange={onUserChange} />
    </BoardProvider>
  );
}

interface NavState {
  newBoardTitle?: string;
}

function BoardScreen({ boardId, user, onUserChange }: { boardId: string } & BoardPageProps) {
  const snapshot = useBoardSnapshot();
  const store = useBoardStore();
  const actions = useBoardActions();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { filters, setFilters, clearFilters } = useFilters();
  const board = snapshot.board;
  const openCardId = params.get('card');
  const newBoardTitle = (location.state as NavState | null)?.newBoardTitle;

  // Name a freshly created board once its initial state has arrived.
  useEffect(() => {
    if (!board || !newBoardTitle) return;
    if (board.version === 0 || board.title === 'Untitled board')
      store.dispatch({ type: 'board.rename', title: newBoardTitle }, { undoable: false });
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [board, newBoardTitle, store, navigate, location.pathname, location.search]);

  useEffect(() => {
    if (!board) return;
    rememberBoard(boardId, board.title);
    document.title = `${board.title} · TaskFlow`;
  }, [boardId, board?.title, board]);

  // Close the card dialog if someone else deletes the card.
  useEffect(() => {
    if (board && openCardId && !board.cards[openCardId]) {
      toast({ title: 'That card no longer exists', description: 'It may have been deleted by a collaborator.' });
      setParams(
        (current) => {
          current.delete('card');
          return current;
        },
        { replace: true },
      );
    }
  }, [board, openCardId, setParams, toast]);

  useHotkey(
    (event) => (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z',
    (event) => {
      event.preventDefault();
      store.undo();
    },
  );

  const openCard = useCallback(
    (cardId: string) =>
      setParams((current) => {
        current.set('card', cardId);
        return current;
      }),
    [setParams],
  );

  const closeCard = useCallback(
    () =>
      setParams(
        (current) => {
          current.delete('card');
          return current;
        },
        { replace: true },
      ),
    [setParams],
  );

  const recentBoards = useMemo(() => {
    const recent = getRecentBoards().filter((b) => b.id !== boardId);
    return [{ id: boardId, title: board?.title ?? 'Loading…', visitedAt: Number.MAX_SAFE_INTEGER }, ...recent];
  }, [boardId, board?.title]);

  const createBoard = (title: string) => {
    const id = createBoardId();
    rememberBoard(id, title);
    navigate(`/b/${id}`, { state: { newBoardTitle: title } satisfies NavState });
  };

  const counts = useMemo(() => {
    if (!board) return { match: 0, total: 0 };
    const all = Object.values(board.cards);
    return { match: filterCards(all, filters, board).length, total: all.length };
  }, [board, filters]);

  const header = (
    <AppHeader
      snapshot={snapshot}
      boardId={boardId}
      boardTitle={board?.title ?? 'Loading…'}
      recentBoards={recentBoards}
      user={user}
      onUserChange={onUserChange}
      onUndo={() => store.undo()}
      onCreateBoard={createBoard}
    />
  );

  if (!board) return <BoardSkeleton header={header} status={snapshot.status} />;

  const openCardModel = openCardId ? board.cards[openCardId] : undefined;

  return (
    <div className="flex h-dvh flex-col">
      <a
        href="#board"
        className="sr-only z-50 rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to board
      </a>
      {header}
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-col gap-3 px-4 pt-4 pb-3 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
          <h1 className="-ml-1.5 flex min-w-0 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <InlineEdit value={board.title} label="Board name" onSave={actions.renameBoard} />
          </h1>
          <FilterBar
            board={board}
            filters={filters}
            onChange={setFilters}
            onClear={clearFilters}
            matchCount={counts.match}
            totalCount={counts.total}
          />
        </div>
        <div id="board" tabIndex={-1} className="min-h-0 flex-1 outline-none" aria-label="Board">
          <Board board={board} filters={filters} actions={actions} onOpenCard={openCard} />
        </div>
      </main>
      {openCardModel && <CardDialog board={board} card={openCardModel} actions={actions} onClose={closeCard} />}
    </div>
  );
}
