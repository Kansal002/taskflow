import { Cloud, CloudOff, LoaderCircle, MonitorSmartphone } from 'lucide-react';
import { focusRing, Tooltip } from '../../components/ui';
import { cn } from '../../lib/cn';
import type { ConnectionStatus as Status } from '../../sync/transport';

interface ConnectionStatusProps {
  status: Status;
  transportKind: 'websocket' | 'local';
  pendingCount: number;
  /** Local mode: clicking the badge explains it (tooltips don't exist on touch screens). */
  onExplainLocal?: () => void;
}

export const LOCAL_MODE_HELP =
  'No sync server configured. Changes are saved in this browser and sync live between its tabs — open a second tab to try it.';

const META: Record<Status, { label: string; className: string }> = {
  connected: {
    label: 'Live',
    className:
      'text-emerald-700 bg-emerald-50 ring-emerald-600/20 dark:text-emerald-300 dark:bg-emerald-500/10 dark:ring-emerald-400/20',
  },
  connecting: {
    label: 'Connecting…',
    className:
      'text-amber-800 bg-amber-50 ring-amber-600/20 dark:text-amber-300 dark:bg-amber-500/10 dark:ring-amber-400/20',
  },
  reconnecting: {
    label: 'Reconnecting…',
    className:
      'text-amber-800 bg-amber-50 ring-amber-600/20 dark:text-amber-300 dark:bg-amber-500/10 dark:ring-amber-400/20',
  },
  offline: {
    label: 'Offline',
    className: 'text-red-700 bg-red-50 ring-red-600/20 dark:text-red-300 dark:bg-red-500/10 dark:ring-red-400/20',
  },
};

/**
 * Connection indicator. A persistent `role="status"` region, so changes such
 * as "Reconnecting…" → "Live" are announced politely to screen readers.
 */
export function ConnectionStatus({ status, transportKind, pendingCount, onExplainLocal }: ConnectionStatusProps) {
  if (transportKind === 'local') {
    return (
      <span role="status" className="inline-flex">
        <Tooltip content={LOCAL_MODE_HELP}>
          <button
            type="button"
            onClick={onExplainLocal}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-900/5 ring-inset hover:bg-zinc-200/70 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-zinc-700 [&_svg]:size-3.5',
              focusRing,
            )}
          >
            <MonitorSmartphone aria-hidden="true" />
            <span>
              Local<span className="hidden sm:inline"> · syncs across tabs</span>
            </span>
          </button>
        </Tooltip>
      </span>
    );
  }

  const meta = META[status];
  const queued = pendingCount > 0 && status !== 'connected';
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset [&_svg]:size-3.5',
        meta.className,
      )}
    >
      {status === 'connected' ? (
        <Cloud aria-hidden="true" />
      ) : status === 'offline' ? (
        <CloudOff aria-hidden="true" />
      ) : (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      )}
      <span>{meta.label}</span>
      {queued && (
        <span className="font-normal opacity-80">
          · {pendingCount} change{pendingCount === 1 ? '' : 's'} queued
        </span>
      )}
    </span>
  );
}
