import { keysBetween } from './fractional-index';
import type { BoardState, Card, Column, Label, Member, Priority } from './types';

export const DEMO_BOARD_ID = 'demo';

const DAY = 24 * 60 * 60 * 1000;

const LABELS: Label[] = [
  { id: 'lbl-bug', name: 'Bug', color: 'red' },
  { id: 'lbl-feature', name: 'Feature', color: 'blue' },
  { id: 'lbl-design', name: 'Design', color: 'violet' },
  { id: 'lbl-a11y', name: 'Accessibility', color: 'teal' },
  { id: 'lbl-perf', name: 'Performance', color: 'amber' },
  { id: 'lbl-docs', name: 'Docs', color: 'green' },
];

const MEMBERS: Member[] = [
  { id: 'mem-ava', name: 'Ava Chen', color: '#6366f1' },
  { id: 'mem-liam', name: 'Liam Patel', color: '#0ea5e9' },
  { id: 'mem-sofia', name: 'Sofia García', color: '#f43f5e' },
  { id: 'mem-noah', name: 'Noah Kim', color: '#10b981' },
];

const DEFAULT_COLUMNS = [
  { id: 'col-todo', title: 'To Do' },
  { id: 'col-progress', title: 'In Progress' },
  { id: 'col-review', title: 'Review' },
  { id: 'col-done', title: 'Done' },
] as const;

type ColumnKey = (typeof DEFAULT_COLUMNS)[number]['id'];

interface SeedCard {
  column: ColumnKey;
  title: string;
  description?: string;
  labels?: string[];
  priority?: Priority;
  assignee?: string;
  dueInDays?: number;
  checklist?: [string, boolean][];
}

const DEMO_CARDS: SeedCard[] = [
  {
    column: 'col-todo',
    title: 'Add keyboard shortcuts cheat-sheet',
    description: 'Press `?` anywhere to open a dialog listing every shortcut.',
    labels: ['lbl-feature', 'lbl-a11y'],
    priority: 'medium',
    assignee: 'mem-ava',
    dueInDays: 6,
  },
  {
    column: 'col-todo',
    title: 'Audit colour contrast in dark mode',
    description: 'Run axe + manual checks. Target WCAG 2.2 AA (4.5:1 for body text).',
    labels: ['lbl-a11y', 'lbl-design'],
    priority: 'high',
    assignee: 'mem-sofia',
    dueInDays: 3,
    checklist: [
      ['Board surfaces', false],
      ['Card badges', false],
      ['Focus rings', false],
    ],
  },
  {
    column: 'col-todo',
    title: 'Write onboarding docs for the sync protocol',
    labels: ['lbl-docs'],
    priority: 'low',
  },
  {
    column: 'col-todo',
    title: 'Virtualise very long columns',
    description: 'Columns with 500+ cards drop frames while dragging. Investigate windowing.',
    labels: ['lbl-perf'],
    priority: 'none',
    assignee: 'mem-noah',
  },
  {
    column: 'col-progress',
    title: 'Real-time presence avatars',
    description: 'Show who else is viewing the board, with a stable colour per person.',
    labels: ['lbl-feature'],
    priority: 'high',
    assignee: 'mem-liam',
    dueInDays: 1,
    checklist: [
      ['Presence message in protocol', true],
      ['Avatar stack in header', true],
      ['Editable display name', false],
    ],
  },
  {
    column: 'col-progress',
    title: 'Card drops into wrong column on Safari',
    description: 'Repro: drag quickly across two columns while the board is scrolled.',
    labels: ['lbl-bug'],
    priority: 'urgent',
    assignee: 'mem-noah',
    dueInDays: -1,
  },
  {
    column: 'col-review',
    title: 'Offline queue + replay on reconnect',
    description:
      'Ops created while disconnected are queued and replayed in order once the socket reconnects. The server de-duplicates by op id.',
    labels: ['lbl-feature'],
    priority: 'medium',
    assignee: 'mem-ava',
    dueInDays: 2,
    checklist: [
      ['Exponential backoff', true],
      ['Queue persisted in memory', true],
      ['Tests with mock WebSocket', true],
    ],
  },
  {
    column: 'col-review',
    title: 'Redesign empty states',
    labels: ['lbl-design'],
    priority: 'low',
    assignee: 'mem-sofia',
  },
  {
    column: 'col-done',
    title: 'Fractional indexing for card order',
    description: 'Moves only touch the moved card, so concurrent moves never clobber each other.',
    labels: ['lbl-feature', 'lbl-perf'],
    priority: 'medium',
    assignee: 'mem-liam',
  },
  {
    column: 'col-done',
    title: 'Screen-reader announcements for drag and drop',
    labels: ['lbl-a11y'],
    priority: 'high',
    assignee: 'mem-ava',
    checklist: [
      ['Pick up / move / drop messages', true],
      ['Use card + column names', true],
    ],
  },
];

function startOfUtcDay(now: number): number {
  return Math.floor(now / DAY) * DAY;
}

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function baseBoard(id: string, title: string): BoardState {
  const columnOrders = keysBetween(null, null, DEFAULT_COLUMNS.length);
  const columns: Record<string, Column> = {};
  DEFAULT_COLUMNS.forEach((col, i) => {
    columns[col.id] = { id: col.id, title: col.title, order: columnOrders[i] as string };
  });
  return {
    id,
    title,
    columns,
    cards: {},
    labels: Object.fromEntries(LABELS.map((l) => [l.id, { ...l }])),
    members: Object.fromEntries(MEMBERS.map((m) => [m.id, { ...m }])),
    version: 0,
  };
}

/**
 * Creates the demo board. Deterministic for a given UTC day, so two tabs (or
 * the client and the server) seeding independently produce identical state.
 */
export function createDemoBoard(id: string = DEMO_BOARD_ID, now: number = Date.now()): BoardState {
  const board = baseBoard(id, 'Product Launch');
  const today = startOfUtcDay(now);
  const byColumn = new Map<ColumnKey, SeedCard[]>();
  for (const card of DEMO_CARDS) {
    byColumn.set(card.column, [...(byColumn.get(card.column) ?? []), card]);
  }

  let n = 0;
  for (const [columnId, seeds] of byColumn) {
    const orders = keysBetween(null, null, seeds.length);
    seeds.forEach((seed, i) => {
      n += 1;
      const id = `card-${n}`;
      const card: Card = {
        id,
        columnId,
        order: orders[i] as string,
        title: seed.title,
        description: seed.description ?? '',
        labelIds: seed.labels ?? [],
        priority: seed.priority ?? 'none',
        assigneeId: seed.assignee ?? null,
        dueDate: seed.dueInDays === undefined ? null : toIsoDate(today + seed.dueInDays * DAY),
        checklist: (seed.checklist ?? []).map(([text, done], j) => ({ id: `${id}-chk-${j + 1}`, text, done })),
        createdAt: today,
        updatedAt: today,
      };
      board.cards[id] = card;
    });
  }
  return board;
}

/** A fresh board with the default columns and label set, but no cards. */
export function createEmptyBoard(id: string, title = 'Untitled board'): BoardState {
  return baseBoard(id, title);
}

/** What the authority creates the first time someone joins `boardId`. */
export function createInitialBoard(boardId: string, now: number = Date.now()): BoardState {
  return boardId === DEMO_BOARD_ID ? createDemoBoard(boardId, now) : createEmptyBoard(boardId);
}
