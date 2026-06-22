import { describe, expect, it } from "vitest";
import { isAdditiveCanvasPatch } from "@/lib/elt/canvas-patch-safety";

describe("isAdditiveCanvasPatch", () => {
  const before = [{ id: "n1" }, { id: "n2" }, { id: "n3" }];

  it("returns true when nodes are only added", () => {
    expect(isAdditiveCanvasPatch(before, [...before, { id: "n4" }])).toBe(true);
  });

  it("returns false when nodes are removed", () => {
    expect(isAdditiveCanvasPatch(before, [{ id: "n1" }, { id: "n2" }])).toBe(false);
  });

  it("returns false when node ids are replaced", () => {
    expect(isAdditiveCanvasPatch(before, [{ id: "n1" }, { id: "n2" }, { id: "n9" }])).toBe(false);
  });
});
