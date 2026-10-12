import { describe, expect, test } from "vitest";
import { EXPLAINER_IDS, EXPLAINERS, getExplainer, STEP_ICONS } from "./service-explainers";

describe("service explainers", () => {
  test("ids fit what the database accepts", () => {
    for (const id of EXPLAINER_IDS) expect(id).toMatch(/^[a-z0-9-]{1,40}$/);
  });

  test.each(EXPLAINER_IDS)("%s explains itself in a few short steps", (id) => {
    const explainer = EXPLAINERS[id];
    expect(explainer.summary.length).toBeGreaterThan(20);
    expect(explainer.steps.length).toBeGreaterThanOrEqual(3);
    expect(explainer.steps.length).toBeLessThanOrEqual(4);
    for (const step of explainer.steps) expect(STEP_ICONS).toContain(step.icon);
    expect(explainer.result).not.toBe("");
    expect(explainer.before).not.toBe(explainer.after);
  });

  test("unknown or empty ids have no explanation", () => {
    expect(getExplainer("faros")?.name).toBe("Restauración de faros");
    expect(getExplainer("toString")).toBeNull();
    expect(getExplainer("motor")).toBeNull();
    expect(getExplainer(null)).toBeNull();
  });
});
