import type { PresenceUser } from '@taskflow/shared';
import { Link2, Moon, Sun, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Avatar, IconButton, Tooltip, focusRing, useToast } from '../../components/ui';
import { cn } from '../../lib/cn';
import type { RecentBoard } from '../../lib/recentBoards';
import { useTheme } from '../../lib/useTheme';
import type { BoardSnapshot } from '../../sync/BoardStore';
import { BoardSwitcher } from './BoardSwitcher';
import { ConnectionStatus, LOCAL_MODE_HELP } from './ConnectionStatus';
import { Logo } from './Logo';
import { NewBoardDialog } from './NewBoardDialog';
import { PresenceAvatars } from './PresenceAvatars';
import { ProfileDialog } from './ProfileDialog';

interface AppHeaderProps {
  snapshot: BoardSnapshot;
  boardId: string;
  boardTitle: string;
  recentBoards: RecentBoard[];
  user: PresenceUser;
  onUserChange: (user: PresenceUser) => void;
  onUndo: () => void;
  onCreateBoard: (title: string) => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function AppHeader({
  snapshot,
  boardId,
  boardTitle,
  recentBoards,
  user,
  onUserChange,
  onUndo,
  onCreateBoard,
}: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [profileOpen, setProfileOpen] = useState(false);
  const [newBoardOpen, setNewBoardOpen] = useState(false);

  const copyLink = async () => {
    const url = `${window.location.origin}/b/${boardId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link copied',
        description:
          snapshot.transportKind === 'local'
            ? 'Open it in another tab to see live sync. Cross-device sync needs the sync server.'
            : 'Anyone with the link can view and edit this board.',
        variant: 'success',
      });
    } catch {
      toast({ title: 'Could not copy link', description: url, variant: 'error' });
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex h-14 items-center gap-1.5 px-4 sm:gap-2 sm:px-6">
        <Link
          to="/"
          className={cn('flex shrink-0 items-center gap-2 rounded-md font-semibold tracking-tight', focusRing)}
          aria-label="TaskFlow home"
        >
          <Logo className="size-7" />
          <span className="hidden text-[15px] sm:inline">TaskFlow</span>
        </Link>
        <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
          /
        </span>
        <BoardSwitcher
          currentBoardId={boardId}
          currentTitle={boardTitle}
          recentBoards={recentBoards}
          onNewBoard={() => setNewBoardOpen(true)}
        />

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ConnectionStatus
            status={snapshot.status}
            transportKind={snapshot.transportKind}
            pendingCount={snapshot.pendingCount}
            onExplainLocal={() => toast({ title: 'Local mode', description: LOCAL_MODE_HELP, duration: 8000 })}
          />
          <PresenceAvatars users={snapshot.presence} selfId={user.id} />
          <div className="mx-1 hidden h-5 w-px bg-zinc-200 sm:block dark:bg-zinc-800" aria-hidden="true" />
          <IconButton label="Copy board link" onClick={copyLink}>
            <Link2 />
          </IconButton>
          <IconButton label="Undo" shortcut={isMac ? '⌘Z' : 'Ctrl+Z'} onClick={onUndo} disabled={!snapshot.canUndo}>
            <Undo2 />
          </IconButton>
          <IconButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun /> : <Moon />}
          </IconButton>
          <Tooltip content="Edit your name and colour" describeChild={false}>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              aria-label={`Your profile: ${user.name}`}
              className={cn('ml-0.5 rounded-full', focusRing)}
            >
              <Avatar name={user.name} color={user.color} size="sm" decorative />
            </button>
          </Tooltip>
        </div>
      </div>

      <ProfileDialog open={profileOpen} user={user} onClose={() => setProfileOpen(false)} onSave={onUserChange} />
      <NewBoardDialog open={newBoardOpen} onClose={() => setNewBoardOpen(false)} onCreate={onCreateBoard} />
    </header>
  );
}
