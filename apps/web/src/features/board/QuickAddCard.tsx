import { LIMITS } from '@taskflow/shared';
import { Plus, X } from 'lucide-react';
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button, IconButton } from '../../components/ui';
import { cn } from '../../lib/cn';
import { controlStyles } from '../../components/ui/Field';

interface QuickAddCardProps {
  columnTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (title: string) => void;
}

/**
 * Inline "add a card" composer at the bottom of a column. Stays open after
 * adding so several cards can be entered in a row; Escape closes it.
 */
export function QuickAddCard({ columnTitle, open, onOpenChange, onAdd }: QuickAddCardProps) {
  const [title, setTitle] = useState('');
  const inputId = useId();

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setTitle('');
      onOpenChange(false);
    }
  };

  if (!open) {
    return (
      <div className="px-2 pb-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-zinc-500"
          onClick={() => onOpenChange(true)}
          aria-label={`Add a card to ${columnTitle}`}
        >
          <Plus aria-hidden="true" />
          Add card
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="px-2 pb-2">
      <label htmlFor={inputId} className="sr-only">
        New card title in {columnTitle}
      </label>
      <textarea
        id={inputId}
        // The user just asked to add a card, so focusing the field is expected.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        rows={2}
        value={title}
        maxLength={LIMITS.titleLength}
        placeholder="What needs to be done?"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => !title.trim() && onOpenChange(false)}
        className={cn(controlStyles, 'resize-none py-2 shadow-sm')}
      />
      <div className="mt-2 flex items-center gap-1">
        <Button type="submit" variant="primary" size="sm" disabled={!title.trim()}>
          Add card
        </Button>
        <IconButton
          label="Cancel"
          size="sm"
          showTooltip={false}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setTitle('');
            onOpenChange(false);
          }}
        >
          <X />
        </IconButton>
        <span className="ml-auto hidden text-[11px] text-zinc-400 sm:inline">Enter ↵</span>
      </div>
    </form>
  );
}
