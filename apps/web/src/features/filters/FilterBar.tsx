import { PRIORITIES, type BoardState, type Priority } from '@taskflow/shared';
import { FilterX, Search } from 'lucide-react';
import { useRef } from 'react';
import { Button, Select } from '../../components/ui';
import { controlStyles } from '../../components/ui/Field';
import { cn } from '../../lib/cn';
import { useHotkey } from '../../lib/useHotkey';
import { PRIORITY_META } from '../board/priority';
import { hasActiveFilters, UNASSIGNED, type CardFilters } from './filterCards';

interface FilterBarProps {
  board: BoardState;
  filters: CardFilters;
  onChange: (update: Partial<CardFilters>) => void;
  onClear: () => void;
  matchCount: number;
  totalCount: number;
}

export function FilterBar({ board, filters, onChange, onClear, matchCount, totalCount }: FilterBarProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const active = hasActiveFilters(filters);

  // "/" focuses search, like GitHub/Linear.
  useHotkey(
    (event) => event.key === '/' && !event.metaKey && !event.ctrlKey,
    (event) => {
      event.preventDefault();
      searchRef.current?.focus();
    },
  );

  return (
    <div role="search" className="flex flex-wrap items-end gap-2" aria-label="Filter cards">
      <div className="relative min-w-48 flex-1 sm:max-w-72">
        <label htmlFor="card-search" className="sr-only">
          Search cards
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400"
        />
        <input
          ref={searchRef}
          id="card-search"
          type="search"
          placeholder="Search cards…"
          aria-keyshortcuts="/"
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onChange({ query: '' });
              event.currentTarget.blur();
            }
          }}
          className={cn(controlStyles, 'h-9 pr-8 pl-8')}
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-zinc-200 px-1.5 text-[10px] text-zinc-400 sm:block dark:border-zinc-700">
          /
        </kbd>
      </div>
      <Select
        label="Label"
        hideLabel
        value={filters.labelId ?? ''}
        onChange={(event) => onChange({ labelId: event.target.value || null })}
        options={[
          { value: '', label: 'All labels' },
          ...Object.values(board.labels).map((l) => ({ value: l.id, label: l.name })),
        ]}
        containerClassName="w-[calc(50%-0.25rem)] sm:w-36"
      />
      <Select
        label="Priority"
        hideLabel
        value={filters.priority ?? ''}
        onChange={(event) => onChange({ priority: (event.target.value || null) as Priority | null })}
        options={[
          { value: '', label: 'Any priority' },
          ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label })),
        ]}
        containerClassName="w-[calc(50%-0.25rem)] sm:w-36"
      />
      <Select
        label="Assignee"
        hideLabel
        value={filters.assigneeId ?? ''}
        onChange={(event) => onChange({ assigneeId: event.target.value || null })}
        options={[
          { value: '', label: 'Anyone' },
          { value: UNASSIGNED, label: 'Unassigned' },
          ...Object.values(board.members).map((m) => ({ value: m.id, label: m.name })),
        ]}
        containerClassName="w-[calc(50%-0.25rem)] sm:w-40"
      />
      {active && (
        <Button variant="ghost" size="md" onClick={onClear}>
          <FilterX aria-hidden="true" />
          Clear
        </Button>
      )}
      {/* Always mounted so screen readers announce result-count changes. */}
      <p role="status" className={cn('self-center text-xs text-zinc-500 tabular-nums', !active && 'sr-only')}>
        {active ? `${matchCount} of ${totalCount} cards` : ''}
      </p>
    </div>
  );
}
