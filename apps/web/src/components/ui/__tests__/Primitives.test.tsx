import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Avatar, AvatarGroup } from '../Avatar';
import { Badge } from '../Badge';
import { IconButton } from '../IconButton';
import { Input } from '../Input';
import { Select } from '../Select';
import { Textarea } from '../Textarea';
import { ToastProvider } from '../Toast';
import { Tooltip } from '../Tooltip';
import { useToast, type ToastOptions } from '../useToast';

describe('form controls', () => {
  it('Input wires label and hint to the control', () => {
    render(<Input label="Email" hint="We never share it" />);
    const input = screen.getByRole('textbox', { name: 'Email' });
    expect(input).toHaveAccessibleDescription('We never share it');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('Textarea exposes errors as description + aria-invalid', () => {
    render(<Textarea label="Notes" error="Too long" />);
    const textarea = screen.getByRole('textbox', { name: 'Notes' });
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAccessibleDescription('Too long');
  });

  it('Select renders a labelled native select', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select
        label="Priority"
        hideLabel
        options={[
          { value: 'low', label: 'Low' },
          { value: 'high', label: 'High' },
        ]}
        onChange={(e) => onChange(e.target.value)}
      />,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'high');
    expect(onChange).toHaveBeenCalledWith('high');
  });
});

describe('display primitives', () => {
  it('Avatar shows initials and is named for assistive tech unless decorative', () => {
    const { rerender } = render(<Avatar name="Ada Lovelace" color="#000000" />);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');
    rerender(<Avatar name="Ada Lovelace" color="#000000" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('AvatarGroup collapses overflow into a +N chip', () => {
    const users = ['A One', 'B Two', 'C Three', 'D Four'].map((name, i) => ({ id: String(i), name, color: '#000000' }));
    render(<AvatarGroup users={users} max={2} label="Viewing" />);
    expect(screen.getByRole('list', { name: 'Viewing' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'and 2 more' })).toHaveTextContent('+2');
  });

  it('Badge renders text (colour is never the only signal)', () => {
    render(
      <Badge color="red" dot>
        Bug
      </Badge>,
    );
    expect(screen.getByText('Bug')).toBeInTheDocument();
  });
});

describe('Tooltip', () => {
  const visibleTooltip = () => document.body.querySelector('div[aria-hidden="true"].pointer-events-none');

  it('describes its trigger, shows on keyboard focus and hides on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Deletes forever">
        <button type="button">Delete</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveAccessibleDescription('Deletes forever');

    await user.tab();
    expect(button).toHaveFocus();
    expect(visibleTooltip()).toHaveTextContent('Deletes forever');
    await user.keyboard('{Escape}');
    expect(visibleTooltip()).toBeNull();
  });

  it('IconButton uses its label as the accessible name without a duplicate description', () => {
    render(
      <IconButton label="Close">
        <svg />
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button).not.toHaveAttribute('aria-describedby');
  });
});

describe('Toast', () => {
  function Trigger(props: ToastOptions) {
    const { toast } = useToast();
    return (
      <button type="button" onClick={() => toast(props)}>
        Notify
      </button>
    );
  }

  it('announces toasts in a polite live region and supports an action', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(
      <ToastProvider>
        <Trigger title="Card deleted" action={{ label: 'Undo', onClick: onUndo }} />
      </ToastProvider>,
    );
    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(region.querySelector('[aria-live="polite"]')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.getByText('Card deleted').closest('[aria-live="polite"]')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
    expect(screen.queryByText('Card deleted')).not.toBeInTheDocument();
  });

  it('uses an assertive region for errors and auto-dismisses', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger title="Sync failed" variant="error" duration={1000} />
      </ToastProvider>,
    );
    act(() => screen.getByRole('button', { name: 'Notify' }).click());
    expect(screen.getByText('Sync failed').closest('[aria-live="assertive"]')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText('Sync failed')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('can be dismissed manually', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger title="Hello" duration={Infinity} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
  });
});
