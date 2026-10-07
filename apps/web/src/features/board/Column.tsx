import type { BoardState, Card, Column as ColumnModel } from '@taskflow/shared';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Ellipsis, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { memo, useId, useState } from 'react';
import { DropdownMenu, IconButton } from '../../components/ui';
import { cn } from '../../lib/cn';
import { SortableCard } from './CardItem';
import { InlineEdit } from './InlineEdit';
import { QuickAddCard } from './QuickAddCard';
import type { BoardActions } from './useBoardActions';

interface ColumnProps {
  column: ColumnModel;
  /** Card ids in display order (may differ from `cards` order mid-drag). */
  itemIds: string[];
  cards: Record<string, Card>;
  /** Total cards in the column, ignoring filters. */
  totalCount: number;
  filtered: boolean;
  labels: BoardState['labels'];
  members: BoardState['members'];
  actions: BoardActions;
  onOpenCard: (cardId: string) => void;
}

export const columnWidth = 'w-[min(85vw,18rem)]';

export const Column = memo(function Column({
  column,
  itemIds,
  cards,
  totalCount,
  filtered,
  labels,
  members,
  actions,
  onOpenCard,
}: ColumnProps) {
  const headingId = useId();
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);

  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column' },
  });

  const countLabel = filtered ? `${itemIds.length} of ${totalCount}` : String(totalCount);

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        columnWidth,
        'flex max-h-full shrink-0 snap-start flex-col rounded-xl bg-zinc-100/80 ring-1 ring-zinc-900/[0.04] dark:bg-zinc-900/70 dark:ring-white/[0.06]',
        isDragging && 'opacity-50',
      )}
    >
      <header className="flex items-center gap-1 px-1.5 pt-2 pb-1.5">
        <IconButton
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-roledescription="draggable column"
          label={`Reorder column ${column.title}`}
          size="sm"
          showTooltip={false}
          className="cursor-grab text-zinc-400 active:cursor-grabbing"
        >
          <GripVertical />
        </IconButton>
        <h2
          id={headingId}
          className="flex min-w-0 flex-1 items-center text-sm font-semibold text-zinc-800 dark:text-zinc-100"
        >
          <InlineEdit
            value={column.title}
            label="Column name"
            onSave={(title) => actions.renameColumn(column.id, title)}
            editing={renaming}
            onEditingChange={setRenaming}
          />
        </h2>
        <span
          className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-[11px] font-medium text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-400"
          aria-label={filtered ? `${itemIds.length} of ${totalCount} cards shown` : `${totalCount} cards`}
        >
          {countLabel}
        </span>
        <DropdownMenu
          align="end"
          label={`${column.title} column actions`}
          trigger={(props) => (
            <IconButton {...props} label={`${column.title} column actions`} size="sm" showTooltip={false}>
              <Ellipsis />
            </IconButton>
          )}
          items={[
            { id: 'add', label: 'Add card', icon: <Plus />, onSelect: () => setAdding(true) },
            { id: 'rename', label: 'Rename column', icon: <Pencil />, onSelect: () => setRenaming(true) },
            { type: 'separator', id: 'sep' },
            {
              id: 'delete',
              label: 'Delete column',
              icon: <Trash2 />,
              danger: true,
              onSelect: () => actions.deleteColumn(column.id),
            },
          ]}
        />
      </header>

      <SortableContext id={column.id} items={itemIds} strategy={verticalListSortingStrategy}>
        <ol
          aria-labelledby={headingId}
          className="flex min-h-14 flex-1 flex-col gap-2 overflow-y-auto px-2 pt-0.5 pb-2 scrollbar-thin"
        >
          {itemIds.map((id) => {
            const card = cards[id];
            return card ? (
              <SortableCard key={id} card={card} labels={labels} members={members} onOpen={onOpenCard} />
            ) : null;
          })}
          {itemIds.length === 0 && (
            <li className="flex min-h-14 list-none items-center justify-center rounded-lg border border-dashed border-zinc-300 px-3 text-center text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
              {filtered && totalCount > 0 ? 'No matching cards' : 'Drop cards here'}
            </li>
          )}
        </ol>
      </SortableContext>

      <QuickAddCard
        columnTitle={column.title}
        open={adding}
        onOpenChange={setAdding}
        onAdd={(title) => actions.createCard(column.id, title)}
      />
    </section>
  );
});
