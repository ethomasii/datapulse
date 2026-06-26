import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { autoLayoutPipelineCanvas } from "./canvas-auto-layout";
import { estimateNodeLayout } from "./canvas-node-placement";

describe("autoLayoutPipelineCanvas", () => {
  it("spaces source, destination, and components on one horizontal band", () => {
    const nodes: Node[] = [
      { id: "s", type: "sourceNode", position: { x: 0, y: 0 }, data: {} },
      { id: "d", type: "destNode", position: { x: 50, y: 200 }, data: {} },
      {
        id: "c1",
        type: "componentNode",
        position: { x: 100, y: 50 },
        data: { compileHint: "" },
      },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "s", target: "d" },
      { id: "e2", source: "d", target: "c1" },
    ];

    const laid = autoLayoutPipelineCanvas(nodes, edges);
    const byId = new Map(laid.map((n) => [n.id, n]));

    expect(byId.get("s")!.position.x).toBeLessThan(byId.get("d")!.position.x);
    expect(byId.get("d")!.position.x).toBeLessThan(byId.get("c1")!.position.x);

    const destCenter = byId.get("d")!.position.y + estimateNodeLayout(byId.get("d")!).height / 2;
    const compCenter = byId.get("c1")!.position.y + estimateNodeLayout(byId.get("c1")!).height / 2;
    expect(compCenter).toBeCloseTo(destCenter, 0);
  });
});
