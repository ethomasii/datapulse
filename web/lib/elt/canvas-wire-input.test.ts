import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import {
  expandUpstreamSources,
  rewireAllComponentInputs,
  resolveCanvasAutoWireSourceId,
  wireInputFromUpstreamEdge,
  type WireInputContext,
} from "@/lib/elt/canvas-wire-input";

describe("canvas-wire-input", () => {
  const ctx: WireInputContext = {
    rawLandingTables: ["github_to_motherduck.issues", "github_to_motherduck.pull_requests"],
  };

  it("fills downstream table from upstream component output", () => {
    const nodes: Node[] = [
      {
        id: "up",
        type: "componentNode",
        position: { x: 0, y: 0 },
        data: { config: { output_table: "staging.raw" } },
      },
      {
        id: "down",
        type: "componentNode",
        position: { x: 200, y: 0 },
        data: { config: {} },
      },
    ];
    const edges: Edge[] = [{ id: "e1", source: "up", target: "down" }];
    const wired = wireInputFromUpstreamEdge(nodes, edges, "down");
    expect(wired?.configPatch.table).toBe("staging.raw");
    expect(wired?.configPatch._preview_nonce).toBeDefined();
  });

  it("fills input table when wired from Source node using pipeline landing tables", () => {
    const nodes: Node[] = [
      { id: "src", type: "sourceNode", position: { x: 0, y: 0 }, data: {} },
      { id: "sel", type: "componentNode", position: { x: 200, y: 0 }, data: { config: {} } },
    ];
    const edges: Edge[] = [{ id: "e1", source: "src", target: "sel" }];
    const wired = wireInputFromUpstreamEdge(nodes, edges, "sel", ctx);
    expect(wired?.configPatch.table).toBe("github_to_motherduck.issues");
    expect(wired?.configPatch.input_table).toBe("github_to_motherduck.issues");
  });

  it("skips Output node and resolves upstream Source for autofill", () => {
    const nodes: Node[] = [
      { id: "src", type: "sourceNode", position: { x: 0, y: 0 }, data: {} },
      { id: "dest", type: "destNode", position: { x: 200, y: 0 }, data: {} },
      { id: "sel", type: "componentNode", position: { x: 400, y: 0 }, data: { config: {} } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "src", target: "dest" },
      { id: "e2", source: "dest", target: "sel" },
    ];
    const wired = wireInputFromUpstreamEdge(nodes, edges, "sel", ctx);
    expect(wired?.configPatch.table).toBe("github_to_motherduck.issues");
  });

  it("expandUpstreamSources walks through dest to source", () => {
    const nodes: Node[] = [
      { id: "src", type: "sourceNode", position: { x: 0, y: 0 }, data: {} },
      { id: "dest", type: "destNode", position: { x: 200, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [{ id: "e1", source: "src", target: "dest" }];
    const expanded = expandUpstreamSources(nodes, edges, "dest");
    expect(expanded.map((n) => n.id)).toEqual(["src"]);
  });

  it("resolveCanvasAutoWireSourceId wires from the pipeline tail (Output after load)", () => {
    const nodes: Node[] = [
      { id: "src", type: "sourceNode", position: { x: 0, y: 0 }, data: {} },
      { id: "dest", type: "destNode", position: { x: 200, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [{ id: "e1", source: "src", target: "dest" }];
    const dest = nodes.find((n) => n.type === "destNode")!;
    const upstreamId = resolveCanvasAutoWireSourceId(nodes, edges, dest, {
      type: "componentNode",
      data: { category: "transformation" },
    });
    expect(upstreamId).toBe("dest");
  });

  it("rewireAllComponentInputs patches saved graphs with empty tables", () => {
    const nodes: Node[] = [
      { id: "src", type: "sourceNode", position: { x: 0, y: 0 }, data: {} },
      {
        id: "sel",
        type: "componentNode",
        position: { x: 200, y: 0 },
        data: { componentId: "select_columns", config: {} },
      },
    ];
    const edges: Edge[] = [{ id: "e1", source: "src", target: "sel" }];
    const rewired = rewireAllComponentInputs(nodes, edges, ctx);
    const sel = rewired.find((n) => n.id === "sel");
    expect((sel?.data as { config: Record<string, string> }).config.table).toBe(
      "github_to_motherduck.issues"
    );
  });
});
