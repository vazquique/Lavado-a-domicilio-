import { describe, expect, test } from "vitest";
import { isCarPart, partsLabels, partsWorkedOn, serviceIcon } from "./car-parts";

describe("partsWorkedOn", () => {
  test("joins the parts of every chosen service, without repeats, in drawing order", () => {
    expect(
      partsWorkedOn([{ carParts: ["wheels", "body"] }, { carParts: ["seats"] }, { carParts: ["body"] }]),
    ).toEqual(["body", "wheels", "seats"]);
  });

  test("nothing chosen, nothing lit", () => {
    expect(partsWorkedOn([])).toEqual([]);
  });
});

describe("serviceIcon", () => {
  test("extras that cover most of the car show the whole car", () => {
    expect(
      serviceIcon({ kind: "extra", area: "exterior", carParts: ["body", "windows", "wheels", "lights", "trim"] }),
    ).toBe("complete");
  });

  test("main services show a wash, unless they cover the whole car", () => {
    expect(serviceIcon({ kind: "base", area: "exterior", carParts: ["body", "windows", "wheels"] })).toBe("wash");
    expect(
      serviceIcon({ kind: "base", area: "exterior", carParts: ["body", "windows", "wheels", "floors", "dashboard"] }),
    ).toBe("wash");
    expect(
      serviceIcon({
        kind: "base",
        area: "exterior",
        carParts: ["body", "windows", "wheels", "lights", "trim", "seats", "floors", "dashboard"],
      }),
    ).toBe("complete");
  });

  test("extras show their most specific part", () => {
    expect(serviceIcon({ kind: "extra", area: "exterior", carParts: ["wheels"] })).toBe("wheels");
    expect(serviceIcon({ kind: "extra", area: "interior", carParts: ["seats", "floors"] })).toBe("seats");
    expect(serviceIcon({ kind: "extra", area: "exterior", carParts: ["body"] })).toBe("body");
  });

  test("without parts, the area decides", () => {
    expect(serviceIcon({ kind: "extra", area: "interior", carParts: [] })).toBe("seats");
    expect(serviceIcon({ kind: "extra", area: "exterior", carParts: [] })).toBe("body");
  });
});

describe("isCarPart", () => {
  test("only known parts", () => {
    expect(isCarPart("wheels")).toBe(true);
    expect(isCarPart("engine")).toBe(false);
    expect(isCarPart(3)).toBe(false);
  });
});

describe("partsLabels", () => {
  test("names the parts, or the whole area when it's all of it", () => {
    expect(partsLabels(["wheels"])).toEqual(["Rines y llantas"]);
    expect(partsLabels(["seats", "floors", "dashboard"])).toEqual(["Todo el interior"]);
    expect(partsLabels(["body", "windows", "wheels", "lights", "trim", "seats"])).toEqual([
      "Todo el exterior",
      "Asientos y vestiduras",
    ]);
    expect(partsLabels(["body", "windows", "wheels", "lights", "trim", "seats", "floors", "dashboard"])).toEqual([
      "Todo el auto",
    ]);
  });
});
