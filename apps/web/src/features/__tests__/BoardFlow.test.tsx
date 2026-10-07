import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../../App';
import { ToastProvider } from '../../components/ui';

/**
 * End-to-end-ish flow through the real app: router → BoardProvider → local
 * transport → BoardStore → shared reducer → UI.
 */
function renderBoard(path = '/b/test-board') {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </ToastProvider>,
  );
  return user;
}

const column = (name: string) => screen.getByRole('region', { name });
const cardButton = (title: RegExp | string) => screen.getByRole('button', { name: new RegExp(title) });

describe('board flow', () => {
  it('renders the seeded demo board', async () => {
    renderBoard('/b/demo');
    expect(await screen.findByRole('heading', { level: 1, name: 'Product Launch' })).toBeInTheDocument();
    for (const name of ['To Do', 'In Progress', 'Review', 'Done']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    expect(within(column('In Progress')).getByText('Real-time presence avatars')).toBeInTheDocument();
  });

  it('creates, edits, deletes and restores a card', async () => {
    const user = renderBoard();
    await screen.findByRole('region', { name: 'To Do' });

    // Quick-add a card.
    await user.click(screen.getByRole('button', { name: 'Add a card to To Do' }));
    await user.type(screen.getByRole('textbox', { name: 'New card title in To Do' }), 'Write tests{Enter}');
    expect(within(column('To Do')).getByText('Write tests')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    // Open it and edit several fields.
    await user.click(cardButton('Write tests'));
    const dialog = await screen.findByRole('dialog', { name: 'Card details' });
    const title = within(dialog).getByRole('textbox', { name: 'Title' });
    expect(title).toHaveFocus();
    await user.clear(title);
    await user.type(title, 'Write more tests{Enter}');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Priority' }), 'high');
    await user.click(within(dialog).getByRole('button', { name: 'Bug' }));
    expect(within(dialog).getByRole('button', { name: 'Bug' })).toHaveAttribute('aria-pressed', 'true');
    await user.type(within(dialog).getByRole('textbox', { name: 'New checklist item' }), 'Unit tests{Enter}');
    expect(within(dialog).getByRole('checkbox', { name: 'Unit tests' })).not.toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // The card reflects the edits.
    const card = cardButton('Write more tests');
    expect(card).toHaveTextContent('High');
    expect(card).toHaveTextContent('Bug');
    expect(card).toHaveTextContent('Checklist: 0/1 done');

    // Move it via the column picker.
    await user.click(card);
    await user.selectOptions(
      within(await screen.findByRole('dialog')).getByRole('combobox', { name: 'Column' }),
      'col-review',
    );
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(within(column('Review')).getByText('Write more tests')).toBeInTheDocument();

    // Delete, then undo from the toast.
    await user.click(cardButton('Write more tests'));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete card' }));
    expect(screen.queryByText('Write more tests')).not.toBeInTheDocument();
    const notifications = screen.getByRole('region', { name: 'Notifications' });
    await user.click(await within(notifications).findByRole('button', { name: 'Undo' }));
    expect(within(column('Review')).getByText('Write more tests')).toBeInTheDocument();
  });

  it('filters cards by text and priority', async () => {
    const user = renderBoard('/b/demo');
    await screen.findByRole('region', { name: 'To Do' });

    await user.type(screen.getByRole('searchbox', { name: 'Search cards' }), 'safari');
    expect(screen.getByText('Card drops into wrong column on Safari')).toBeInTheDocument();
    expect(screen.queryByText('Real-time presence avatars')).not.toBeInTheDocument();
    // The result count lives in a live region so screen readers hear it change.
    expect(screen.getByText(/1 of \d+ cards/)).toHaveAttribute('role', 'status');

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Real-time presence avatars')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'urgent');
    expect(screen.getAllByRole('button', { name: /Urgent/ })).toHaveLength(1);
  });

  it('adds, renames and deletes a column, and undoes with Ctrl+Z', async () => {
    const user = renderBoard();
    await screen.findByRole('region', { name: 'To Do' });

    await user.click(screen.getByRole('button', { name: 'Add column' }));
    await user.type(screen.getByRole('textbox', { name: 'Column name' }), 'Backlog{Enter}');
    expect(await screen.findByRole('region', { name: 'Backlog' })).toBeInTheDocument();

    // Rename via the column's menu (keyboard path).
    await user.click(within(column('Backlog')).getByRole('button', { name: 'Backlog column actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename column' }));
    const input = within(column('Backlog')).getByRole('textbox', { name: 'Column name' });
    await user.clear(input);
    await user.type(input, 'Icebox{Enter}');
    expect(screen.getByRole('region', { name: 'Icebox' })).toBeInTheDocument();

    await user.click(within(column('Icebox')).getByRole('button', { name: 'Icebox column actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete column' }));
    expect(screen.queryByRole('region', { name: 'Icebox' })).not.toBeInTheDocument();

    await user.click(document.body);
    await user.keyboard('{Control>}z{/Control}');
    expect(await screen.findByRole('region', { name: 'Icebox' })).toBeInTheDocument();
  });

  it('renames the board inline and remembers it in the switcher', async () => {
    const user = renderBoard();
    await user.click(await screen.findByRole('button', { name: 'Untitled board' }));
    const input = screen.getByRole('textbox', { name: 'Board name' });
    await user.clear(input);
    await user.type(input, 'Sprint 42{Enter}');
    expect(screen.getByRole('heading', { level: 1, name: 'Sprint 42' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Switch board/ }));
    const menu = screen.getByRole('menu', { name: 'Switch board' });
    expect(within(menu).getByRole('menuitemradio', { name: 'Sprint 42' })).toHaveAttribute('aria-checked', 'true');
    expect(within(menu).getByRole('menuitemradio', { name: 'Product Launch' })).toBeInTheDocument();
  });

  it('opens a card from a deep link', async () => {
    renderBoard('/b/demo?card=card-1');
    const dialog = await screen.findByRole('dialog', { name: 'Card details' });
    expect(within(dialog).getByRole('textbox', { name: 'Title' })).toHaveValue('Add keyboard shortcuts cheat-sheet');
  });

  it('explains when a linked card no longer exists', async () => {
    renderBoard('/b/demo?card=ghost');
    expect(await screen.findByText('That card no longer exists')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a 404 for invalid board ids', async () => {
    renderBoard('/b/not%20valid!');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('lets the user edit their profile', async () => {
    const user = renderBoard();
    await user.click(await screen.findByRole('button', { name: /Your profile/ }));
    const dialog = screen.getByRole('dialog', { name: 'Your profile' });
    const name = within(dialog).getByRole('textbox', { name: 'Display name' });
    await user.clear(name);
    await user.type(name, 'Grace Hopper');
    await user.click(within(dialog).getAllByRole('radio')[2]!);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Your profile: Grace Hopper' })).toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem('taskflow:user')!)).toMatchObject({ name: 'Grace Hopper' });
  });
});
