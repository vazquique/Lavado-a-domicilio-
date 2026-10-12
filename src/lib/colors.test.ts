import { expect, test } from "vitest";
import { readableTextColor } from "./colors";

test("dark backgrounds get white text, light ones black", () => {
  expect(readableTextColor("#1d4ed8")).toBe("#ffffff");
  expect(readableTextColor("#000000")).toBe("#ffffff");
  expect(readableTextColor("#facc15")).toBe("#000000");
  expect(readableTextColor("#ffffff")).toBe("#000000");
});
