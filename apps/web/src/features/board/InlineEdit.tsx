import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { focusRing } from '../../components/ui';
import { cn } from '../../lib/cn';

interface InlineEditProps {
  value: string;
  /** Accessible label for the input, e.g. "Column name". The button is named by its visible text. */
  label: string;
  onSave: (value: string) => void;
  className?: string;
  inputClassName?: string;
  maxLength?: number;
  /** Controlled editing state (optional) so e.g. a menu item can start editing. */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

/**
 * Text that turns into an input when activated. Enter or blur saves,
 * Escape cancels. Empty or unchanged values are discarded.
 */
export function InlineEdit({
  value,
  label,
  onSave,
  className,
  inputClassName,
  maxLength = 200,
  editing: controlledEditing,
  onEditingChange,
}: InlineEditProps) {
  const hintId = useId();
  const [uncontrolledEditing, setUncontrolledEditing] = useState(false);
  const editing = controlledEditing ?? uncontrolledEditing;

  const setEditing = (next: boolean) => {
    setUncontrolledEditing(next);
    onEditingChange?.(next);
  };

  if (editing) {
    return (
      <InlineEditInput
        initialValue={value}
        label={label}
        maxLength={maxLength}
        className={inputClassName}
        onDone={(next) => {
          if (next !== null && next !== value) onSave(next);
          setEditing(false);
        }}
      />
    );
  }

  // The visible text names the button (so a heading wrapping it keeps a clean
  // name). The hint is `hidden`: still usable via aria-describedby, but not
  // folded into the surrounding heading's accessible name.
  return (
    <>
      <button
        type="button"
        aria-describedby={hintId}
        onClick={() => setEditing(true)}
        className={cn(
          'min-w-0 cursor-text truncate rounded-md px-1.5 py-0.5 text-left hover:bg-zinc-200/70 dark:hover:bg-zinc-800',
          focusRing,
          className,
        )}
      >
        {value}
      </button>
      <span id={hintId} hidden>
        Activate to rename
      </span>
    </>
  );
}

/** Mounted fresh each time editing starts, so the draft always begins from the latest value. */
function InlineEditInput({
  initialValue,
  label,
  maxLength,
  className,
  onDone,
}: {
  initialValue: string;
  label: string;
  maxLength: number;
  className?: string;
  /** Called with the trimmed value, or null when cancelled / empty. */
  onDone: (value: string | null) => void;
}) {
  const [draft, setDraft] = useState(initialValue);
  const finished = useRef(false);

  const finish = (value: string | null) => {
    if (finished.current) return;
    finished.current = true;
    onDone(value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(draft.trim() || null);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish(null);
    }
  };

  return (
    <input
      // Moving focus into the field is the expected result of choosing "rename".
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      aria-label={label}
      value={draft}
      maxLength={maxLength}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => finish(draft.trim() || null)}
      onKeyDown={onKeyDown}
      onFocus={(event) => event.target.select()}
      className={cn(
        'w-full min-w-0 rounded-md border border-accent-500 bg-white px-1.5 py-0.5 text-zinc-900 ring-2 ring-accent-500/25 outline-none dark:bg-zinc-900 dark:text-zinc-100',
        className,
      )}
    />
  );
}
