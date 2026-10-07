import { useState } from 'react';

/**
 * Local editable copy of a value that can also change remotely.
 *
 * While the user is editing, remote updates don't clobber their typing; once
 * they stop editing, the draft follows the latest remote value again.
 */
export function useDraft<T>(value: T) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  const [editing, setEditing] = useState(false);

  // "Adjust state while rendering" — React's recommended alternative to an effect.
  if (!editing && value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  return {
    draft,
    setDraft,
    editing,
    startEditing: () => setEditing(true),
    stopEditing: () => setEditing(false),
    reset: () => {
      setDraft(value);
      setEditing(false);
    },
  };
}
