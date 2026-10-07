import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../App';
import { ToastProvider } from '../../components/ui';

/**
 * jsdom has no layout engine, so we give columns and cards a fake grid
 * geometry: columns 300px apart, cards stacked 80px apart. That is enough
 * for dnd-kit's keyboard sensor + collision detection to run for real.
 */
function fakeLayout(this: Element): DOMRect {
  const rect = (x: number, y: number, width: number, height: number) =>
    ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect;

  // dnd-kit's DragOverlay wrapper is positioned with inline styles taken from
  // the active node (dnd-kit measures the wrapper's single child).
  const overlay = [this, this.parentElement].find(
    (el): el is HTMLElement => el instanceof HTMLElement && el.style.position === 'fixed' && el.style.width !== '1px',
  );
  if (overlay) {
    const px = (value: string) => parseFloat(value) || 0;
    return rect(px(overlay.style.left), px(overlay.style.top), px(overlay.style.width), px(overlay.style.height));
  }

  const section = this.closest('section[aria-labelledby]');
  if (!section) return rect(0, 0, 0, 0);
  const columns = Array.from(document.querySelectorAll('main section[aria-labelledby]'));
  const columnX = columns.indexOf(section) * 300;

  if (this === section) return rect(columnX, 0, 280, 800);
  const li = this.closest('li');
  if (li && section.contains(li)) {
    const index = Array.from(li.parentElement!.children).indexOf(li);
    return rect(columnX + 8, 60 + index * 80, 264, 72);
  }
  return rect(columnX, 0, 280, 40);
}

function renderDemo() {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/b/demo']}>
        <AppRoutes />
      </MemoryRouter>
    </ToastProvider>,
  );
}

const columnCards = (name: string) =>
  within(screen.getByRole('region', { name }))
    .queryAllByRole('button', { name: /./ })
    .filter((el) => el.getAttribute('aria-roledescription') === 'draggable card')
    .map((el) => el.querySelector('p')?.textContent);

/** dnd-kit's keyboard sensor listens on window and moves on animation frames. */
async function press(key: string, code = key) {
  await act(async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key, code });
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

/** Records every message dnd-kit writes to its screen-reader live region. */
function recordAnnouncements() {
  const messages: string[] = [];
  const observer = new MutationObserver(() => {
    const region = document.querySelector('[id^="DndLiveRegion"]');
    const text = region?.textContent ?? '';
    if (text && messages.at(-1) !== text) messages.push(text);
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  return { messages, stop: () => observer.disconnect() };
}

describe('keyboard drag and drop', () => {
  let announcements: ReturnType<typeof recordAnnouncements>;
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(fakeLayout);
    announcements = recordAnnouncements();
  });
  afterEach(() => {
    announcements.stop();
    vi.restoreAllMocks();
  });

  it('moves a card to the next column with Space → ArrowRight → Space, announcing each step', async () => {
    renderDemo();
    await screen.findByRole('region', { name: 'To Do' });
    const title = 'Add keyboard shortcuts cheat-sheet';
    expect(columnCards('To Do')).toContain(title);

    const card = screen.getByRole('button', { name: new RegExp(title) });
    act(() => card.focus());
    await press(' ', 'Space');
    expect(announcements.messages).toContain(`Picked up card “${title}”, in column “To Do”, position 1 of 4.`);

    await press('ArrowRight');
    await press(' ', 'Space');

    expect(columnCards('To Do')).not.toContain(title);
    expect(columnCards('In Progress')).toContain(title);
    expect(announcements.messages.at(-1)).toMatch(new RegExp(`^Card “${title}” was dropped in column “In Progress”`));
  });

  it('reorders a card within its column with ArrowDown', async () => {
    renderDemo();
    await screen.findByRole('region', { name: 'To Do' });
    const before = columnCards('To Do');
    const card = screen.getByRole('button', { name: new RegExp(before[0]!) });
    act(() => card.focus());
    await press(' ', 'Space');
    await press('ArrowDown');
    await press(' ', 'Space');
    const after = columnCards('To Do');
    expect(after).toHaveLength(before.length);
    expect(after.indexOf(before[0]!)).toBeGreaterThan(0);
  });

  it('cancels with Escape and leaves the board unchanged', async () => {
    renderDemo();
    await screen.findByRole('region', { name: 'To Do' });
    const before = columnCards('To Do');
    const card = screen.getByRole('button', { name: new RegExp(before[0]!) });
    act(() => card.focus());
    await press(' ', 'Space');
    await press('ArrowRight');
    await press('Escape');
    expect(columnCards('To Do')).toEqual(before);
    expect(announcements.messages.at(-1)).toMatch(/Moving was cancelled/);
  });

  it('opens the card with Enter instead of starting a drag', async () => {
    renderDemo();
    await screen.findByRole('region', { name: 'To Do' });
    const card = screen.getByRole('button', { name: /Add keyboard shortcuts cheat-sheet/ });
    act(() => card.focus());
    await press('Enter');
    expect(await screen.findByRole('dialog', { name: 'Card details' })).toBeInTheDocument();
  });

  it('reorders columns with the drag handle', async () => {
    renderDemo();
    await screen.findByRole('region', { name: 'To Do' });
    const handle = screen.getByRole('button', { name: 'Reorder column To Do' });
    act(() => handle.focus());
    await press(' ', 'Space');
    await press('ArrowRight');
    await press(' ', 'Space');
    const order = Array.from(document.querySelectorAll('main section[aria-labelledby] h2 button')).map(
      (h) => h.textContent,
    );
    expect(order.indexOf('To Do')).toBeGreaterThan(0);
  });
});
