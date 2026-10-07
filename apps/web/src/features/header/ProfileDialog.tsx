import type { PresenceUser } from '@taskflow/shared';
import { useState, type FormEvent } from 'react';
import { Avatar, Button, Dialog, Input } from '../../components/ui';
import { cn } from '../../lib/cn';
import { PRESENCE_COLORS } from '../../lib/identity';

interface ProfileDialogProps {
  open: boolean;
  user: PresenceUser;
  onClose: () => void;
  onSave: (user: PresenceUser) => void;
}

/** Edit the display name and colour other collaborators see. */
export function ProfileDialog({ open, user, onClose, onSave }: ProfileDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Your profile"
      description="This is how you appear to collaborators."
    >
      {/* Keyed so the form starts fresh from the saved user each time it opens. */}
      {open && <ProfileForm key={user.id + user.name + user.color} user={user} onClose={onClose} onSave={onSave} />}
    </Dialog>
  );
}

function ProfileForm({ user, onClose, onSave }: Omit<ProfileDialogProps, 'open'>) {
  const [name, setName] = useState(user.name);
  const [color, setColor] = useState(user.color);
  const trimmed = name.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed) return;
    onSave({ ...user, name: trimmed, color });
    onClose();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={trimmed || '?'} color={color} size="md" decorative />
        <Input
          label="Display name"
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          error={trimmed ? undefined : 'Please enter a name'}
          containerClassName="flex-1"
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {PRESENCE_COLORS.map((swatch) => (
            <label key={swatch} className="relative cursor-pointer">
              <input
                type="radio"
                name="presence-color"
                value={swatch}
                checked={color === swatch}
                onChange={() => setColor(swatch)}
                className="peer sr-only"
                aria-label={`Colour ${swatch}`}
              />
              <span
                aria-hidden="true"
                style={{ backgroundColor: swatch }}
                className={cn(
                  'block size-7 rounded-full ring-offset-2 ring-offset-white transition-shadow peer-focus-visible:ring-2 peer-focus-visible:ring-accent-500 dark:ring-offset-zinc-900',
                  color === swatch && 'ring-2 ring-zinc-900 dark:ring-zinc-100',
                )}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!trimmed}>
          Save
        </Button>
      </div>
    </form>
  );
}
