import { LIMITS, type ChecklistItem } from '@taskflow/shared';
import { Plus, X } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Button, IconButton, Input } from '../../components/ui';
import { cn } from '../../lib/cn';
import { createId } from '../../lib/id';

interface ChecklistProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}

export function Checklist({ items, onChange }: ChecklistProps) {
  const headingId = useId();
  const progressId = useId();
  const [text, setText] = useState('');
  const done = items.filter((item) => item.done).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;

  const add = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || items.length >= LIMITS.checklistItems) return;
    onChange([...items, { id: createId('chk'), text: trimmed, done: false }]);
    setText('');
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 id={headingId} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Checklist
        </h3>
        {items.length > 0 && (
          <span id={progressId} className="text-xs text-zinc-500 tabular-nums">
            {done} of {items.length} done
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div
          role="progressbar"
          aria-labelledby={headingId}
          aria-describedby={progressId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width]',
              percent === 100 ? 'bg-emerald-500' : 'bg-accent-500',
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <ul className="flex flex-col">
        {items.map((item) => (
          <li
            key={item.id}
            className="group flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
          >
            <input
              id={`chk-${item.id}`}
              type="checkbox"
              checked={item.done}
              onChange={() => onChange(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
              className="size-4 shrink-0 cursor-pointer rounded accent-accent-600"
            />
            <label
              htmlFor={`chk-${item.id}`}
              className={cn(
                'min-w-0 flex-1 cursor-pointer text-sm break-words',
                item.done ? 'text-zinc-400 line-through' : 'text-zinc-800 dark:text-zinc-200',
              )}
            >
              {item.text}
            </label>
            <IconButton
              label={`Remove “${item.text}”`}
              size="sm"
              showTooltip={false}
              className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => onChange(items.filter((i) => i.id !== item.id))}
            >
              <X />
            </IconButton>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="flex items-end gap-2">
        <Input
          label="New checklist item"
          hideLabel
          placeholder="Add an item…"
          value={text}
          maxLength={LIMITS.titleLength}
          onChange={(event) => setText(event.target.value)}
          containerClassName="flex-1"
        />
        <Button type="submit" disabled={!text.trim()}>
          <Plus aria-hidden="true" />
          Add
        </Button>
      </form>
    </section>
  );
}
