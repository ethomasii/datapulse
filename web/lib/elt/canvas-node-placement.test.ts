import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { findCanvasAppendTarget } from "./canvas-node-placement";

const backbone: Node[] = [
  { id: "s", type: "sourceNode", position: { x: 40, y: 120 }, data: {} },
  { id: "d", type: "destNode", position: { x: 360, y: 120 }, data: {} },
];

const backboneEdges: Edge[] = [{ id: "e1", source: "s", target: "d" }];

describe("findCanvasAppendTarget", () => {
  it("places after destination on default source→dest graph", () => {
    const { position, upstreamId } = findCanvasAppendTarget(backbone, backboneEdges);
    expect(upstreamId).toBe("d");
    expect(position.x).toBeGreaterThan(360);
    expect(position.y).toBe(120);
  });

  it("chains after an existing component on the same row as destination", () => {
    const nodes: Node[] = [
      ...backbone,
      { id: "c1", type: "componentNode", position: { x: 628, y: 120 }, data: {} },
    ];
    const edges: Edge[] = [...backboneEdges, { id: "e2", source: "d", target: "c1" }];
    const { position, upstreamId } = findCanvasAppendTarget(nodes, edges);
    expect(upstreamId).toBe("c1");
    expect(position.x).toBeGreaterThan(628);
    expect(position.y).toBe(120);
  });
});
