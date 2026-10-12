export type Ordered = { id: string; sortOrder: number };

// Moves an item one place up or down among the items of its group (e.g. the interior
// extras) and numbers that group 10, 20, 30… `items` come in the order they're shown.
// Returns only the items whose order changed (nothing if it can't move further).
export function moveWithinGroup<T extends Ordered>(
  items: readonly T[],
  groupOf: (item: T) => string,
  id: string,
  direction: "up" | "down",
): Ordered[] {
  const moving = items.find((item) => item.id === id);
  if (!moving) return [];
  const group = items.filter((item) => groupOf(item) === groupOf(moving));
  const from = group.indexOf(moving);
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= group.length) return [];

  const reordered = [...group];
  [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
  return reordered
    .map((item, index) => ({ id: item.id, sortOrder: (index + 1) * 10, before: item.sortOrder }))
    .filter((item) => item.sortOrder !== item.before)
    .map(({ id: itemId, sortOrder }) => ({ id: itemId, sortOrder }));
}

// Where a new item goes: after the last one of its group.
export function nextSortOrder(items: readonly Ordered[]): number {
  return items.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 10;
}
