import { Link } from 'react-router';
import { focusRing } from '../components/ui';
import { cn } from '../lib/cn';

export function NotFound() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-semibold text-accent-600">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-sm text-sm text-zinc-500">
        Board links look like <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/b/your-board</code> and may
        only contain letters, numbers, dashes and underscores.
      </p>
      <Link
        to="/b/demo"
        className={cn(
          'mt-2 rounded-lg bg-accent-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-700',
          focusRing,
        )}
      >
        Open the demo board
      </Link>
    </main>
  );
}
