import { describe, expect, it } from "vitest";
import {
  isAdditiveCanvasPatch,
  isInPlaceCanvasPatch,
  isLocalCanvasPreviewPatch,
} from "@/lib/elt/canvas-patch-safety";

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

describe("isInPlaceCanvasPatch", () => {
  const before = [{ id: "n1" }, { id: "n2" }];

  it("returns true when only node data or positions change", () => {
    expect(isInPlaceCanvasPatch(before, before)).toBe(true);
  });

  it("returns false when nodes are added or removed", () => {
    expect(isInPlaceCanvasPatch(before, [...before, { id: "n3" }])).toBe(false);
    expect(isInPlaceCanvasPatch(before, [{ id: "n1" }])).toBe(false);
  });
});

describe("isLocalCanvasPreviewPatch", () => {
  const before = [{ id: "n1" }, { id: "n2" }];

  it("allows Genie preview for append and in-place edits", () => {
    expect(isLocalCanvasPreviewPatch(before, [...before, { id: "n3" }])).toBe(true);
    expect(isLocalCanvasPreviewPatch(before, before)).toBe(true);
    expect(isLocalCanvasPreviewPatch(before, [{ id: "n1" }, { id: "n9" }])).toBe(false);
  });
});
