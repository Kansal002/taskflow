import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button';
import { Dialog } from '../Dialog';

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div id="root">
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Edit card"
        description="Make some changes"
        footer={<Button onClick={() => setOpen(false)}>Save</Button>}
      >
        <input aria-label="First field" />
        <input aria-label="Second field" />
      </Dialog>
    </div>
  );
}

describe('Dialog', () => {
  it('is an accessible modal dialog, labelled and described', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));

    const dialog = screen.getByRole('dialog', { name: 'Edit card' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Make some changes');
  });

  it('moves focus into the dialog and traps Tab / Shift+Tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));

    const first = screen.getByRole('textbox', { name: 'First field' });
    expect(first).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Second field' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    await user.tab(); // wraps to the first focusable element (close button)
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
    await user.tab({ shift: true }); // and back again
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on backdrop click but not on clicks inside the panel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));

    await user.click(screen.getByRole('textbox', { name: 'First field' }));
    expect(onClose).not.toHaveBeenCalled();

    const backdrop = screen.getByRole('dialog').parentElement!;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('makes the app root inert and locks scroll while open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const root = document.getElementById('root')!;
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(root).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');

    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(root).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
  });
});
