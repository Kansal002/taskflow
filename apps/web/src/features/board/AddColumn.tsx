import { LIMITS } from '@taskflow/shared';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Input } from '../../components/ui';

export function AddColumn({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
    setOpen(false);
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        className="h-11 w-[min(85vw,18rem)] shrink-0 justify-start rounded-xl border border-dashed border-zinc-300 text-zinc-500 dark:border-zinc-700"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden="true" />
        Add column
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-[min(85vw,18rem)] shrink-0 self-start rounded-xl bg-zinc-100 p-2 dark:bg-zinc-900"
    >
      <Input
        label="Column name"
        hideLabel
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        placeholder="Column name"
        value={title}
        maxLength={LIMITS.titleLength}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setTitle('');
            setOpen(false);
          }
        }}
      />
      <div className="mt-2 flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={!title.trim()}>
          Add column
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setTitle('');
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
