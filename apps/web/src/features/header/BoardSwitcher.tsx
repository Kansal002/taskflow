import { ChevronsUpDown, Plus, SquareKanban } from 'lucide-react';
import { useNavigate } from 'react-router';
import { DropdownMenu, focusRing, type MenuEntry } from '../../components/ui';
import { cn } from '../../lib/cn';
import type { RecentBoard } from '../../lib/recentBoards';

interface BoardSwitcherProps {
  currentBoardId: string;
  currentTitle: string;
  recentBoards: RecentBoard[];
  onNewBoard: () => void;
}

export function BoardSwitcher({ currentBoardId, currentTitle, recentBoards, onNewBoard }: BoardSwitcherProps) {
  const navigate = useNavigate();
  const items: MenuEntry[] = [
    { type: 'label', id: 'recent-label', label: 'Recent boards' },
    ...recentBoards.map((board): MenuEntry => ({
      id: board.id,
      label: board.title,
      icon: <SquareKanban />,
      checked: board.id === currentBoardId,
      onSelect: () => navigate(`/b/${board.id}`),
    })),
    { type: 'separator', id: 'sep' },
    { id: 'new', label: 'New board…', icon: <Plus />, onSelect: onNewBoard },
  ];

  return (
    <DropdownMenu
      label="Switch board"
      items={items}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={`Switch board (current: ${currentTitle})`}
          className={cn(
            'inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800',
            focusRing,
          )}
        >
          <span className="max-w-[9rem] truncate sm:max-w-[16rem]">{currentTitle}</span>
          <ChevronsUpDown aria-hidden="true" className="size-3.5 shrink-0 text-zinc-400" />
        </button>
      )}
    />
  );
}
