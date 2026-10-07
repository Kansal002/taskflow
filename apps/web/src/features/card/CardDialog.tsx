import { getSortedColumns, LIMITS, PRIORITIES, type BoardState, type Card, type Priority } from '@taskflow/shared';
import { Trash2 } from 'lucide-react';
import { useId, useRef } from 'react';
import { Button, Dialog, Input, Select, Textarea } from '../../components/ui';
import { dotColors } from '../../components/ui/badgeStyles';
import { cn } from '../../lib/cn';
import { useDraft } from '../../lib/useDraft';
import { PRIORITY_META } from '../board/priority';
import type { BoardActions } from '../board/useBoardActions';
import { Checklist } from './Checklist';

interface CardDialogProps {
  board: BoardState;
  card: Card;
  actions: BoardActions;
  onClose: () => void;
}

/**
 * Card details editor. Every change is applied immediately as its own small
 * op (no "Save" button), so collaborators see edits live and concurrent edits
 * to *different* fields merge cleanly.
 */
export function CardDialog({ board, card, actions, onClose }: CardDialogProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const labelsHeadingId = useId();
  const title = useDraft(card.title);
  const description = useDraft(card.description);

  const update = actions.updateCard.bind(null, card.id);
  const columns = getSortedColumns(board);
  const column = board.columns[card.columnId];

  const commitTitle = () => {
    title.stopEditing();
    const next = title.draft.trim();
    if (next && next !== card.title) update({ title: next });
    else title.setDraft(card.title);
  };

  const commitDescription = () => {
    description.stopEditing();
    if (description.draft !== card.description) update({ description: description.draft });
  };

  const toggleLabel = (labelId: string) => {
    const labelIds = card.labelIds.includes(labelId)
      ? card.labelIds.filter((id) => id !== labelId)
      : [...card.labelIds, labelId];
    update({ labelIds });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Card details"
      description={column ? `Column: ${column.title}` : undefined}
      initialFocusRef={titleRef}
      footer={
        <>
          <p className="mr-auto text-xs text-zinc-400">
            Created {new Date(card.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </p>
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/15"
            onClick={() => {
              onClose();
              actions.deleteCard(card.id);
            }}
          >
            <Trash2 aria-hidden="true" />
            Delete card
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Textarea
          ref={titleRef}
          label="Title"
          value={title.draft}
          maxLength={LIMITS.titleLength}
          rows={1}
          onFocus={title.startEditing}
          onChange={(event) => title.setDraft(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          error={title.draft.trim() ? undefined : 'A card needs a title'}
          className="min-h-0 resize-none text-base font-semibold"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Column"
            value={card.columnId}
            options={columns.map((c) => ({ value: c.id, label: c.title }))}
            onChange={(event) => actions.moveCardToColumn(card.id, event.target.value)}
          />
          <Select
            label="Priority"
            value={card.priority}
            options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
            onChange={(event) => update({ priority: event.target.value as Priority })}
          />
          <Select
            label="Assignee"
            value={card.assigneeId ?? ''}
            options={[
              { value: '', label: 'Unassigned' },
              ...Object.values(board.members).map((m) => ({ value: m.id, label: m.name })),
            ]}
            onChange={(event) => update({ assigneeId: event.target.value || null })}
          />
          <Input
            label="Due date"
            type="date"
            value={card.dueDate ?? ''}
            onChange={(event) => update({ dueDate: event.target.value || null })}
          />
        </div>

        <fieldset aria-labelledby={labelsHeadingId}>
          <legend id={labelsHeadingId} className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Labels
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(board.labels).map((label) => {
              const selected = card.labelIds.includes(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleLabel(label.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    'outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-900',
                    selected
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
                  )}
                >
                  <span aria-hidden="true" className={cn('size-2 rounded-full', dotColors[label.color])} />
                  {label.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Textarea
          label="Description"
          placeholder="Add more detail…"
          value={description.draft}
          maxLength={LIMITS.descriptionLength}
          rows={4}
          className="min-h-24"
          onFocus={description.startEditing}
          onChange={(event) => description.setDraft(event.target.value)}
          onBlur={commitDescription}
        />

        <Checklist items={card.checklist} onChange={(checklist) => update({ checklist })} />
      </div>
    </Dialog>
  );
}
