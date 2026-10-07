import type { BoardState, Card } from '@taskflow/shared';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlignLeft, CalendarDays, ListChecks } from 'lucide-react';
import { memo, type KeyboardEvent } from 'react';
import { Avatar, Badge, focusRing } from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatDueDate, getDueState } from '../../lib/date';
import { PRIORITY_META } from './priority';

interface CardContentProps {
  card: Card;
  labels: BoardState['labels'];
  members: BoardState['members'];
}

/** Visual content of a card, shared by the in-list card and the drag overlay. */
export const CardContent = memo(function CardContent({ card, labels, members }: CardContentProps) {
  const cardLabels = card.labelIds.flatMap((id) => (labels[id] ? [labels[id]] : []));
  const assignee = card.assigneeId ? members[card.assigneeId] : undefined;
  const doneCount = card.checklist.filter((item) => item.done).length;
  const dueState = card.dueDate ? getDueState(card.dueDate) : null;
  const priority = PRIORITY_META[card.priority];
  const hasMeta = card.priority !== 'none' || card.dueDate || card.checklist.length > 0 || card.description || assignee;

  return (
    <>
      {cardLabels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {cardLabels.map((label) => (
            <Badge key={label.id} color={label.color} dot>
              {label.name}
            </Badge>
          ))}
        </div>
      )}
      <p className="text-sm leading-snug font-medium break-words text-zinc-900 dark:text-zinc-100">{card.title}</p>
      {hasMeta && (
        <div className="mt-2.5 flex min-h-5 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          {card.priority !== 'none' && (
            <span className={cn('inline-flex items-center gap-1 [&_svg]:size-3.5', priority.className)}>
              {priority.icon}
              <span className="sr-only">Priority: </span>
              <span>{priority.label}</span>
            </span>
          )}
          {card.dueDate && dueState && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-1 py-0.5 [&_svg]:size-3.5',
                dueState === 'overdue' && 'bg-red-50 font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300',
                dueState === 'today' &&
                  'bg-amber-50 font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
              )}
            >
              <CalendarDays aria-hidden="true" />
              <span className="sr-only">{dueState === 'overdue' ? 'Overdue, was due' : 'Due'} </span>
              {formatDueDate(card.dueDate)}
            </span>
          )}
          {card.checklist.length > 0 && (
            <span
              className={cn(
                'inline-flex items-center gap-1 [&_svg]:size-3.5',
                doneCount === card.checklist.length && 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              <ListChecks aria-hidden="true" />
              <span className="sr-only">Checklist: </span>
              {doneCount}/{card.checklist.length}
              <span className="sr-only"> done</span>
            </span>
          )}
          {card.description && (
            <span className="inline-flex [&_svg]:size-3.5">
              <AlignLeft aria-hidden="true" />
              <span className="sr-only">Has description</span>
            </span>
          )}
          {assignee && (
            <span className="ml-auto inline-flex items-center">
              <span className="sr-only">Assigned to {assignee.name}</span>
              <Avatar name={assignee.name} color={assignee.color} size="xs" decorative />
            </span>
          )}
        </div>
      )}
    </>
  );
});

export const cardSurface =
  'rounded-lg border border-zinc-200/80 bg-white p-3 shadow-xs dark:border-zinc-700/70 dark:bg-zinc-800/90';

interface SortableCardProps extends CardContentProps {
  onOpen: (cardId: string) => void;
  /** Disable dragging (e.g. while a filter hides siblings would make positions ambiguous). */
  disabled?: boolean;
}

/** A card in a column: draggable with pointer or keyboard, Enter opens its details. */
export const SortableCard = memo(function SortableCard({ card, labels, members, onOpen, disabled }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.columnId },
    disabled,
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Space starts a keyboard drag (dnd-kit); Enter opens the card.
    if (event.key === 'Enter' && !isDragging) {
      event.preventDefault();
      onOpen(card.id);
      return;
    }
    listeners?.onKeyDown?.(event);
  };

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className="list-none">
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-roledescription="draggable card"
        onKeyDown={onKeyDown}
        onClick={() => onOpen(card.id)}
        data-card-id={card.id}
        className={cn(
          cardSurface,
          'cursor-grab touch-manipulation transition-[border-color,box-shadow] hover:border-zinc-300 hover:shadow-sm active:cursor-grabbing dark:hover:border-zinc-600',
          focusRing,
          'focus-visible:ring-offset-zinc-100 dark:focus-visible:ring-offset-zinc-900',
          isDragging && 'opacity-40',
        )}
      >
        <CardContent card={card} labels={labels} members={members} />
      </div>
    </li>
  );
});
