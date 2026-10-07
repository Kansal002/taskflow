import {
  closestCenter,
  DndContext,
  DragOverlay,
  getFirstCollision,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { getCardsByColumn, getSortedColumns, orderForIndex, type BoardState, type Card } from '@taskflow/shared';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { filterCards, hasActiveFilters, type CardFilters } from '../filters/filterCards';
import { AddColumn } from './AddColumn';
import { buildAnnouncements, screenReaderInstructions, type DragLookup } from './announcements';
import { CardContent, cardSurface } from './CardItem';
import { Column, columnWidth } from './Column';
import type { BoardActions } from './useBoardActions';

interface BoardProps {
  board: BoardState;
  filters: CardFilters;
  actions: BoardActions;
  onOpenCard: (cardId: string) => void;
}

type Items = Record<string, string[]>;

/**
 * The board canvas: columns and cards with drag and drop.
 *
 * While dragging, a local `dragItems` copy of the layout is updated on every
 * `dragOver` so cards visibly move between columns. Only on drop is a single
 * `card.move` / `column.reorder` op dispatched, with a fractional order key
 * computed from the card's final neighbours — so a drag is one small op, not
 * a stream of them.
 */
export function Board({ board, filters, actions, onOpenCard }: BoardProps) {
  const columns = useMemo(() => getSortedColumns(board), [board]);
  const cardsByColumn = useMemo(() => getCardsByColumn(board), [board]);
  const filtered = hasActiveFilters(filters);

  const baseItems = useMemo<Items>(() => {
    const items: Items = {};
    for (const column of columns) {
      items[column.id] = filterCards(cardsByColumn[column.id] ?? [], filters, board).map((c) => c.id);
    }
    return items;
  }, [columns, cardsByColumn, filters, board]);

  const [dragItems, setDragItems] = useState<Items | null>(null);
  const [active, setActive] = useState<{ id: string; type: 'card' | 'column' } | null>(null);
  const items = dragItems ?? baseItems;
  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  // Latest values for dnd-kit callbacks (collision detection, announcements),
  // which are created once and must not go stale.
  const latest = useRef({ items, board, columns });
  useLayoutEffect(() => {
    latest.current = { items, board, columns };
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long-press on touch so horizontal swiping still scrolls the board.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter is reserved for opening a card; Space picks up and drops.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const findColumn = useCallback((id: UniqueIdentifier, source: Items): string | undefined => {
    const key = String(id);
    if (key in source) return key;
    return Object.keys(source).find((columnId) => source[columnId]?.includes(key));
  }, []);

  /**
   * Columns: closest column centre. Cards: whatever is under the pointer
   * (falling back to rectangle intersection for keyboard drags); if that's a
   * column, refine to the closest card inside it.
   */
  const collisionDetection: CollisionDetection = useCallback((args) => {
    if (args.active.data.current?.type === 'column') {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type === 'column'),
      });
    }
    const pointer = pointerWithin(args);
    const intersections = pointer.length > 0 ? pointer : rectIntersection(args);
    let overId = getFirstCollision(intersections, 'id');
    if (overId == null) return [];

    const columnItems = latest.current.items[String(overId)];
    if (columnItems && columnItems.length > 0) {
      const closest = closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (c) => c.id !== overId && columnItems.includes(String(c.id)),
        ),
      })[0]?.id;
      if (closest != null) overId = closest;
    }
    return [{ id: overId }];
  }, []);

  const onDragStart = ({ active: dragged }: DragStartEvent) => {
    const type = dragged.data.current?.type === 'column' ? 'column' : 'card';
    setActive({ id: String(dragged.id), type });
    if (type === 'card') setDragItems(baseItems);
  };

  const onDragOver = ({ active: dragged, over }: DragOverEvent) => {
    if (!over || dragged.data.current?.type === 'column') return;
    setDragItems((prev) => {
      const current = prev ?? baseItems;
      const from = findColumn(dragged.id, current);
      const to = findColumn(over.id, current);
      if (!from || !to || from === to) return prev;

      const fromItems = (current[from] ?? []).filter((id) => id !== dragged.id);
      const toItems = [...(current[to] ?? [])];
      const overIndex = toItems.indexOf(String(over.id));
      let insertAt = toItems.length;
      if (overIndex >= 0) {
        const translated = dragged.rect.current.translated;
        const below = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;
        insertAt = overIndex + (below ? 1 : 0);
      }
      toItems.splice(insertAt, 0, String(dragged.id));
      return { ...current, [from]: fromItems, [to]: toItems };
    });
  };

  const resetDrag = () => {
    setActive(null);
    setDragItems(null);
  };

  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    const activeId = String(dragged.id);
    if (!over) return resetDrag();

    if (dragged.data.current?.type === 'column') {
      const overColumn = findColumn(over.id, baseItems);
      const from = columnIds.indexOf(activeId);
      const to = overColumn ? columnIds.indexOf(overColumn) : -1;
      if (from >= 0 && to >= 0 && from !== to) {
        const reordered = arrayMove(columnIds, from, to);
        const siblings = reordered.filter((id) => id !== activeId).map((id) => board.columns[id]!);
        actions.reorderColumn(activeId, orderForIndex(siblings, reordered.indexOf(activeId)));
      }
      return resetDrag();
    }

    const current = dragItems ?? baseItems;
    const columnId = findColumn(activeId, current);
    if (!columnId) return resetDrag();
    let list = current[columnId] ?? [];
    const from = list.indexOf(activeId);
    const to = list.indexOf(String(over.id));
    if (to >= 0 && from !== to) list = arrayMove(list, from, to);

    const card = board.cards[activeId];
    const unchanged = card?.columnId === columnId && (baseItems[columnId] ?? []).join() === list.join();
    if (card && !unchanged) {
      // Order key between the *visible* neighbours. With a filter active this
      // still lands the card between those two cards in the full list.
      const siblings = list
        .filter((id) => id !== activeId)
        .map((id) => board.cards[id])
        .filter((c): c is Card => Boolean(c));
      actions.moveCard(activeId, columnId, orderForIndex(siblings, list.indexOf(activeId)));
    }
    resetDrag();
  };

  const lookup: DragLookup = useMemo(
    () => ({
      describe(id, overId) {
        const { board: b, items: it, columns: cols } = latest.current;
        const key = String(id);
        if (b.columns[key]) {
          const target = overId === undefined ? key : (findColumn(overId, it) ?? key);
          return {
            kind: 'column',
            title: b.columns[key].title,
            index: cols.findIndex((c) => c.id === target),
            total: cols.length,
          };
        }
        const anchor = overId === undefined ? key : String(overId);
        const columnId = findColumn(anchor, it);
        const list = columnId ? (it[columnId] ?? []) : [];
        const anchorIndex = list.indexOf(anchor);
        return {
          kind: 'card',
          title: b.cards[key]?.title ?? 'card',
          columnTitle: columnId ? (b.columns[columnId]?.title ?? '') : '',
          // Hovering a column (not a card) means "append to the end".
          index: anchorIndex >= 0 ? anchorIndex : list.length,
          total: list.includes(key) ? list.length : list.length + 1,
        };
      },
    }),
    [findColumn],
  );
  // The lookup only reads `latest` when dnd-kit fires a drag event, never during render.
  // eslint-disable-next-line react-hooks/refs
  const announcements = useMemo(() => buildAnnouncements(lookup), [lookup]);

  const activeCard = active?.type === 'card' ? board.cards[active.id] : undefined;
  const activeColumn = active?.type === 'column' ? board.columns[active.id] : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={resetDrag}
      accessibility={{ announcements, screenReaderInstructions }}
    >
      <div className="flex h-full snap-x snap-mandatory items-start gap-3 overflow-x-auto overscroll-x-contain px-4 pt-1 pb-4 scrollbar-thin sm:snap-none sm:px-6">
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              itemIds={items[column.id] ?? []}
              cards={board.cards}
              totalCount={cardsByColumn[column.id]?.length ?? 0}
              filtered={filtered}
              labels={board.labels}
              members={board.members}
              actions={actions}
              onOpenCard={onOpenCard}
            />
          ))}
        </SortableContext>
        <AddColumn onAdd={actions.createColumn} />
      </div>

      <DragOverlay>
        {activeCard ? (
          <div
            className={cn(
              cardSurface,
              'w-[min(85vw,17rem)] rotate-2 cursor-grabbing shadow-xl ring-2 ring-accent-500/40',
            )}
          >
            <CardContent card={activeCard} labels={board.labels} members={board.members} />
          </div>
        ) : activeColumn ? (
          <div
            className={cn(
              columnWidth,
              'rounded-xl bg-zinc-100 p-3 text-sm font-semibold shadow-xl ring-2 ring-accent-500/40 dark:bg-zinc-900',
            )}
          >
            {activeColumn.title}
            <span className="ml-2 text-xs font-normal text-zinc-500">
              {cardsByColumn[activeColumn.id]?.length ?? 0} cards
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
