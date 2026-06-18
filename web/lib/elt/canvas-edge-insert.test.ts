import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { findNearestEdge, insertNodeOnEdge } from "@/lib/elt/canvas-edge-insert";

describe("canvas-edge-insert", () => {
  const nodes: Node[] = [
    { id: "n1", type: "sourceNode", position: { x: 0, y: 0 }, data: {} },
    { id: "n2", type: "destNode", position: { x: 400, y: 0 }, data: {} },
  ];
  const edges: Edge[] = [{ id: "e1", source: "n1", target: "n2" }];

  it("finds edge near midpoint", () => {
    const hit = findNearestEdge(nodes, edges, { x: 200, y: 5 });
    expect(hit?.id).toBe("e1");
  });

  it("returns null when far from edges", () => {
    expect(findNearestEdge(nodes, edges, { x: 200, y: 200 })).toBeNull();
  });

  it("splits edge when inserting node", () => {
    const newNode: Node = {
      id: "n3",
      type: "componentNode",
      position: { x: 999, y: 999 },
      data: { componentId: "filter_rows" },
    };
    const result = insertNodeOnEdge(nodes, edges, edges[0], newNode);
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
    expect(result.edges.map((e) => `${e.source}->${e.target}`)).toEqual(["n1->n3", "n3->n2"]);
    expect(result.nodes.find((n) => n.id === "n3")?.position).toEqual({ x: 200, y: 0 });
  });
});
