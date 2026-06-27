import { describe, expect, it } from "vitest";
import { appendNodeAfterUpstream, canAddStepAfterNode } from "./canvas-node-append-after";

describe("canvas-node-append-after", () => {
  it("canAddStepAfterNode allows source and blocks terminal validate", () => {
    expect(canAddStepAfterNode({ id: "s", type: "sourceNode", data: {}, position: { x: 0, y: 0 } })).toBe(
      true
    );
    expect(
      canAddStepAfterNode({
        id: "q",
        type: "componentNode",
        data: { category: "check", compileTarget: "quality", canvasPorts: { left: true, right: false } },
        position: { x: 0, y: 0 },
      })
    ).toBe(false);
  });

  it("inserts into a single downstream edge", () => {
    const nodes = [
      { id: "a", type: "componentNode", position: { x: 0, y: 0 }, data: {} },
      { id: "b", type: "componentNode", position: { x: 200, y: 0 }, data: {} },
    ];
    const edges = [{ id: "e-ab", source: "a", target: "b" }];
    const newNode = { id: "n", type: "componentNode", position: { x: 100, y: 0 }, data: {} };
    const result = appendNodeAfterUpstream(nodes, edges, "a", newNode);
    expect(result.nodes).toHaveLength(3);
    expect(result.edges.some((e) => e.source === "a" && e.target === "n")).toBe(true);
    expect(result.edges.some((e) => e.source === "n" && e.target === "b")).toBe(true);
  });
});
