import { LIMITS } from '@taskflow/shared';
import { useState, type FormEvent } from 'react';
import { Button, Dialog, Input } from '../../components/ui';

interface NewBoardDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string) => void;
}

export function NewBoardDialog({ open, onClose, onCreate }: NewBoardDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Create a board"
      description="Starts with To Do, In Progress, Review and Done columns. Share the URL to collaborate."
    >
      {open && <NewBoardForm onClose={onClose} onCreate={onCreate} />}
    </Dialog>
  );
}

function NewBoardForm({ onClose, onCreate }: Omit<NewBoardDialogProps, 'open'>) {
  const [title, setTitle] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    onClose();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="Board name"
        placeholder="e.g. Q3 Roadmap"
        value={title}
        maxLength={LIMITS.titleLength}
        onChange={(event) => setTitle(event.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!title.trim()}>
          Create board
        </Button>
      </div>
    </form>
  );
}
