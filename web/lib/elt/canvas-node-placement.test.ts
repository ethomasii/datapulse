import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import {
  chainCenterY,
  estimateNodeLayout,
  findCanvasAppendTarget,
  positionAfterUpstream,
} from "./canvas-node-placement";

const backbone: Node[] = [
  { id: "s", type: "sourceNode", position: { x: 40, y: 120 }, data: {} },
  { id: "d", type: "destNode", position: { x: 360, y: 120 }, data: {} },
];

const backboneEdges: Edge[] = [{ id: "e1", source: "s", target: "d" }];

describe("estimateNodeLayout", () => {
  it("uses a shorter box when a component has no compile hint", () => {
    expect(estimateNodeLayout({ type: "componentNode", data: {} }).height).toBe(76);
  });
});

describe("findCanvasAppendTarget", () => {
  it("centers a compact component on the destination row", () => {
    const center = chainCenterY(backbone);
    const { position, upstreamId } = findCanvasAppendTarget(backbone, backboneEdges, {
      append: { type: "componentNode", data: { compileHint: "" } },
    });
    expect(upstreamId).toBe("d");
    expect(position.x).toBe(360 + 200 + 88);
    expect(position.y + 76 / 2).toBeCloseTo(center, 0);
  });

  it("chains with spacing from upstream width, not a fixed estimate", () => {
    const compact = { type: "componentNode" as const, data: { compileHint: "" } };
    const first = findCanvasAppendTarget(backbone, backboneEdges, { append: compact });
    const nodes: Node[] = [
      ...backbone,
      {
        id: "c1",
        type: "componentNode",
        position: first.position,
        data: { compileHint: "" },
      },
    ];
    const edges: Edge[] = [...backboneEdges, { id: "e2", source: "d", target: "c1" }];
    const second = findCanvasAppendTarget(nodes, edges, { append: compact });
    const gap = second.position.x - (first.position.x + estimateNodeLayout(nodes[2]!).width);
    expect(gap).toBe(88);
    expect(second.position.y).toBe(first.position.y);
  });
});

describe("positionAfterUpstream", () => {
  it("aligns handle centers between destination and short component", () => {
    const dest = backbone[1]!;
    const pos = positionAfterUpstream(backbone, dest, {
      type: "componentNode",
      data: { compileHint: "" },
    });
    const destCenter = dest.position.y + estimateNodeLayout(dest).height / 2;
    const nextCenter = pos.y + estimateNodeLayout({ type: "componentNode", data: {} }).height / 2;
    expect(nextCenter).toBeCloseTo(destCenter, 0);
  });
});
