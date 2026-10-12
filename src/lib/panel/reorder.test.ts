import { describe, expect, test } from "vitest";
import { moveWithinGroup, nextSortOrder } from "./reorder";

const items = [
  { id: "wash", group: "base", sortOrder: 1 },
  { id: "rims", group: "exterior", sortOrder: 13 },
  { id: "seats", group: "interior", sortOrder: 17 },
  { id: "lights", group: "exterior", sortOrder: 16 },
  { id: "glass", group: "exterior", sortOrder: 16 },
];
const group = (item: (typeof items)[number]) => item.group;

describe("moveWithinGroup", () => {
  test("swaps with the neighbor of the same group and renumbers that group", () => {
    expect(moveWithinGroup(items, group, "lights", "up")).toEqual([
      { id: "lights", sortOrder: 10 },
      { id: "rims", sortOrder: 20 },
      { id: "glass", sortOrder: 30 },
    ]);
  });

  test("other groups don't move", () => {
    const changed = moveWithinGroup(items, group, "glass", "up").map((item) => item.id);
    expect(changed).not.toContain("seats");
    expect(changed).not.toContain("wash");
  });

  test("nothing changes at the ends of a group or for an unknown id", () => {
    expect(moveWithinGroup(items, group, "rims", "up")).toEqual([]);
    expect(moveWithinGroup(items, group, "glass", "down")).toEqual([]);
    expect(moveWithinGroup(items, group, "seats", "down")).toEqual([]);
    expect(moveWithinGroup(items, group, "nope", "up")).toEqual([]);
  });

  test("only returns what changed", () => {
    const tidy = [
      { id: "a", group: "x", sortOrder: 10 },
      { id: "b", group: "x", sortOrder: 20 },
      { id: "c", group: "x", sortOrder: 30 },
    ];
    expect(moveWithinGroup(tidy, (item) => item.group, "c", "up")).toEqual([
      { id: "c", sortOrder: 20 },
      { id: "b", sortOrder: 30 },
    ]);
  });
});

describe("nextSortOrder", () => {
  test("goes after the last one", () => {
    expect(nextSortOrder([{ id: "a", sortOrder: 30 }, { id: "b", sortOrder: 10 }])).toBe(40);
    expect(nextSortOrder([])).toBe(10);
  });
});
