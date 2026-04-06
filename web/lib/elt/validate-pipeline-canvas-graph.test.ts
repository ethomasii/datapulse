import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { validatePipelineCanvasGraph } from "./validate-pipeline-canvas-graph";

const node = (id: string, type: string, data: Record<string, unknown> = {}): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data }) as Node;

describe("validatePipelineCanvasGraph", () => {
  it("passes for connected source → dest with connector types when required", () => {
    const nodes = [node("s", "sourceNode"), node("d", "destNode")];
    const edges: Edge[] = [{ id: "e1", source: "s", target: "d" }];
    const r = validatePipelineCanvasGraph(nodes, edges, {
      requireConnectorTypes: true,
      pipelineSourceType: "github",
      pipelineDestinationType: "duckdb",
    });
    expect(r.ok).toBe(true);
  });

  it("fails without source or destination", () => {
    const r = validatePipelineCanvasGraph([node("d", "destNode")], [], {});
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("source"))).toBe(true);
  });

  it("fails when connector types required but missing", () => {
    const nodes = [node("s", "sourceNode"), node("d", "destNode")];
    const edges: Edge[] = [{ id: "e1", source: "s", target: "d" }];
    const r = validatePipelineCanvasGraph(nodes, edges, { requireConnectorTypes: true });
    expect(r.ok).toBe(false);
  });

  it("fails when transform has no approach", () => {
    const nodes = [
      node("s", "sourceNode"),
      node("d", "destNode"),
      node("t", "transformNode", { transformTool: "" }),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "s", target: "d" },
      { id: "e2", source: "d", target: "t" },
    ];
    const r = validatePipelineCanvasGraph(nodes, edges, {});
    expect(r.ok).toBe(false);
  });

  it("fails when graph is disconnected", () => {
    const nodes = [node("s", "sourceNode"), node("d", "destNode"), node("x", "destNode")];
    const edges: Edge[] = [{ id: "e1", source: "s", target: "d" }];
    const r = validatePipelineCanvasGraph(nodes, edges, {});
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("reachable"))).toBe(true);
  });
});
