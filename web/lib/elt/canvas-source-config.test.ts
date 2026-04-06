import { describe, expect, it } from "vitest";
import { getCanvasFromSourceConfig, stripCanvasFromSourceConfig } from "./canvas-source-config";

describe("canvas-source-config", () => {
  it("strips canvas for export", () => {
    const cfg = { repo_owner: "a", canvas: { nodes: [], edges: [] } };
    const stripped = stripCanvasFromSourceConfig(cfg);
    expect(stripped).toEqual({ repo_owner: "a" });
    expect("canvas" in stripped).toBe(false);
  });

  it("parses canvas from source config", () => {
    const g = { nodes: [{ id: "n1" }], edges: [] };
    expect(getCanvasFromSourceConfig({ canvas: g })).toEqual(g);
    expect(getCanvasFromSourceConfig({})).toBeNull();
  });
});
