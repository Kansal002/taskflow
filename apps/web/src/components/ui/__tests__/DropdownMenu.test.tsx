import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DropdownMenu, type MenuEntry } from '../DropdownMenu';

function setup(items?: MenuEntry[]) {
  const onSelect = { rename: vi.fn(), archive: vi.fn(), delete: vi.fn(), disabled: vi.fn() };
  render(
    <>
      <DropdownMenu
        trigger={(props) => (
          <button type="button" {...props}>
            Actions
          </button>
        )}
        items={
          items ?? [
            { id: 'rename', label: 'Rename', onSelect: onSelect.rename },
            { id: 'archive', label: 'Archive', onSelect: onSelect.archive },
            { id: 'disabled', label: 'Disabled', disabled: true, onSelect: onSelect.disabled },
            { type: 'separator', id: 'sep' },
            { id: 'delete', label: 'Delete', danger: true, onSelect: onSelect.delete },
          ]
        }
      />
      <button type="button">After</button>
    </>,
  );
  return { trigger: screen.getByRole('button', { name: 'Actions' }), onSelect };
}

describe('DropdownMenu', () => {
  it('exposes menu-button semantics', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu', { name: 'Actions' });
    expect(trigger).toHaveAttribute('aria-controls', menu.id);
    expect(screen.getAllByRole('menuitem')).toHaveLength(4);
  });

  it('opens with ArrowDown and focuses the first item; ArrowUp focuses the last', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
  });

  it('uses a roving tabindex and wraps, skipping disabled items', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    trigger.focus();
    await user.keyboard('{Enter}');

    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    expect(rename).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toHaveFocus();
    await user.keyboard('{ArrowDown}'); // skips "Disabled"
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{ArrowDown}'); // wraps
    expect(rename).toHaveFocus();
    await user.keyboard('{ArrowUp}'); // wraps backwards
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(rename).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
  });

  it('supports typeahead', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();
    trigger.focus();
    await user.keyboard('{Enter}');
    await user.keyboard('d');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('a');
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toHaveFocus();
  });

  it('selects with Enter, closes and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    const { trigger, onSelect } = setup();
    trigger.focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    expect(onSelect.archive).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('does not select disabled items', async () => {
    const user = userEvent.setup();
    const { trigger, onSelect } = setup();
    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Disabled' }));
    expect(onSelect.disabled).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem', { name: 'Disabled' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('closes on Escape (returning focus), Tab and outside click', async () => {
    const user = userEvent.setup();
    const { trigger } = setup();

    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.keyboard('{Enter}');
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'After' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders radio items with aria-checked', async () => {
    const user = userEvent.setup();
    const { trigger } = setup([
      { type: 'label', id: 'l', label: 'Boards' },
      { id: 'a', label: 'Board A', checked: true, onSelect: () => {} },
      { id: 'b', label: 'Board B', checked: false, onSelect: () => {} },
    ]);
    await user.click(trigger);
    expect(screen.getByRole('menuitemradio', { name: 'Board A' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Board B' })).toHaveAttribute('aria-checked', 'false');
  });
});
