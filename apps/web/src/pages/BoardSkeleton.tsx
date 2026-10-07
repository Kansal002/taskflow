import type { ReactNode } from 'react';
import type { ConnectionStatus } from '../sync/transport';

/** Placeholder while the first snapshot loads (or while the server is unreachable). */
export function BoardSkeleton({ header, status }: { header?: ReactNode; status?: ConnectionStatus }) {
  const message =
    status === 'offline' || status === 'reconnecting' ? 'Can’t reach the sync server — retrying…' : 'Loading board…';
  return (
    <div className="flex h-dvh flex-col">
      {header ?? <div className="h-14 border-b border-zinc-200/80 dark:border-zinc-800" />}
      <main className="flex-1 px-4 pt-4 sm:px-6" aria-busy="true">
        <p role="status" className="mb-4 text-sm text-zinc-500">
          {message}
        </p>
        <div className="flex gap-3 overflow-hidden" aria-hidden="true">
          {[5, 3, 4, 2].map((cards, i) => (
            <div key={i} className="w-[min(85vw,18rem)] shrink-0 rounded-xl bg-zinc-100 p-2 dark:bg-zinc-900">
              <div className="mb-3 h-5 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              {Array.from({ length: cards }, (_, j) => (
                <div key={j} className="mb-2 h-16 animate-pulse rounded-lg bg-white dark:bg-zinc-800/70" />
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
