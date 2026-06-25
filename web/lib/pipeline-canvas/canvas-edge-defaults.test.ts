import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { filterEdgesToPipelineRules, resolveCanvasEdges } from "@/components/pipeline-canvas/canvas-edge-defaults";

const ns = (ids: { id: string; type: string }[]): Node[] =>
  ids.map((x, i) => ({
    id: x.id,
    type: x.type,
    position: { x: i * 100, y: 0 },
    data: {},
  })) as Node[];

describe("filterEdgesToPipelineRules", () => {
  it("allows source → dest and dest → transform", () => {
    const nodes = ns([
      { id: "s", type: "sourceNode" },
      { id: "d", type: "destNode" },
      { id: "t", type: "transformNode" },
    ]);
    const edges = [
      { id: "e1", source: "s", target: "d" },
      { id: "e2", source: "d", target: "t" },
    ];
    expect(filterEdgesToPipelineRules(nodes, edges)).toHaveLength(2);
  });

  it("rejects transform → dest and transform → source", () => {
    const nodes = ns([
      { id: "s", type: "sourceNode" },
      { id: "d", type: "destNode" },
      { id: "t", type: "transformNode" },
    ]);
    const edges = [
      { id: "e1", source: "t", target: "d" },
      { id: "e2", source: "t", target: "s" },
    ];
    expect(filterEdgesToPipelineRules(nodes, edges)).toHaveLength(0);
  });

  it("allows transform → transform only after transform", () => {
    const nodes = ns([
      { id: "d", type: "destNode" },
      { id: "t1", type: "transformNode" },
      { id: "t2", type: "transformNode" },
    ]);
    const edges = [{ id: "e1", source: "t1", target: "t2" }];
    expect(filterEdgesToPipelineRules(nodes, edges)).toHaveLength(1);
  });

  it("rejects source → transform (skip load)", () => {
    const nodes = ns([
      { id: "s", type: "sourceNode" },
      { id: "t", type: "transformNode" },
    ]);
    const edges = [{ id: "e1", source: "s", target: "t" }];
    expect(filterEdgesToPipelineRules(nodes, edges)).toHaveLength(0);
  });
});

describe("resolveCanvasEdges", () => {
  const backboneNodes = ns([
    { id: "s1", type: "sourceNode" },
    { id: "d1", type: "destNode" },
  ]);

  it("infers backbone wiring when edges are missing", () => {
    const edges = resolveCanvasEdges(backboneNodes, undefined);
    expect(edges).toHaveLength(1);
    expect(edges[0]?.source).toBe("s1");
    expect(edges[0]?.target).toBe("d1");
  });

  it("respects an explicit empty edge list", () => {
    expect(resolveCanvasEdges(backboneNodes, [])).toHaveLength(0);
  });
});
