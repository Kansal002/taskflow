import type { Meta, StoryObj } from '@storybook/react-vite';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarGroup } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { DropdownMenu } from './DropdownMenu';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { Select } from './Select';
import { Textarea } from './Textarea';
import { Tooltip } from './Tooltip';
import { useToast } from './useToast';

/**
 * TaskFlow's accessible UI primitives. Every interactive story is fully
 * keyboard operable — try Tab, arrow keys, Enter, Space and Escape.
 */
const meta: Meta = {
  title: 'UI/Primitives',
};
export default meta;

type Story = StoryObj;

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary">
        <Plus aria-hidden="true" /> Primary
      </Button>
      <Button>Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button size="sm">Small</Button>
      <Button disabled>Disabled</Button>
      <IconButton label="Copy link">
        <Copy />
      </IconButton>
      <IconButton label="Edit" variant="secondary" shortcut="E">
        <Pencil />
      </IconButton>
    </div>
  ),
};

export const FormControls: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4">
      <Input label="Display name" placeholder="Ada Lovelace" hint="Shown to collaborators" />
      <Input label="Email" defaultValue="not-an-email" error="Enter a valid email address" />
      <Select
        label="Priority"
        options={[
          { value: 'low', label: 'Low' },
          { value: 'high', label: 'High' },
        ]}
      />
      <Textarea label="Description" placeholder="Add more detail…" />
    </div>
  ),
};

export const BadgesAndAvatars: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {(['red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink', 'neutral', 'accent'] as const).map(
          (color) => (
            <Badge key={color} color={color} dot>
              {color}
            </Badge>
          ),
        )}
      </div>
      <div className="flex items-center gap-3">
        <Avatar name="Ada Lovelace" color="#4f46e5" size="md" />
        <AvatarGroup
          label="Viewing"
          users={['Ava Chen', 'Liam Patel', 'Sofia García', 'Noah Kim', 'Mia Wong', 'Leo Diaz'].map((name, i) => ({
            id: String(i),
            name,
            color: ['#4f46e5', '#0284c7', '#dc2626', '#16a34a', '#ca8a04', '#9333ea'][i] as string,
          }))}
        />
      </div>
    </div>
  ),
};

export const TooltipStory: Story = {
  name: 'Tooltip',
  render: () => (
    <Tooltip content="Archived cards can be restored later">
      <Button>Archive</Button>
    </Tooltip>
  ),
};

export const Menu: Story = {
  render: () => (
    <DropdownMenu
      label="Card actions"
      trigger={(props) => <Button {...props}>Actions</Button>}
      items={[
        { id: 'edit', label: 'Edit', icon: <Pencil />, onSelect: () => {} },
        { id: 'copy', label: 'Copy link', icon: <Copy />, hint: '⌘C', onSelect: () => {} },
        { id: 'disabled', label: 'Archive (disabled)', disabled: true, onSelect: () => {} },
        { type: 'separator', id: 'sep' },
        { id: 'delete', label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => {} },
      ]}
    />
  ),
};

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Rename board"
        description="Focus is trapped inside; Escape closes and focus returns to the button."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Save
            </Button>
          </>
        }
      >
        <Input label="Board name" defaultValue="Product Launch" />
      </Dialog>
    </>
  );
}

export const DialogStory: Story = { name: 'Dialog', render: () => <DialogDemo /> };

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex gap-2">
      <Button onClick={() => toast({ title: 'Card deleted', action: { label: 'Undo', onClick: () => {} } })}>
        Info toast
      </Button>
      <Button onClick={() => toast({ title: 'Link copied', variant: 'success' })}>Success toast</Button>
      <Button onClick={() => toast({ title: 'Sync failed', description: 'Retrying…', variant: 'error' })}>
        Error toast
      </Button>
    </div>
  );
}

export const Toasts: Story = { render: () => <ToastDemo /> };
