import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { wireInputFromUpstreamEdge } from "@/lib/elt/canvas-wire-input";

describe("canvas-wire-input", () => {
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

  it("fills downstream table from upstream output", () => {
    const wired = wireInputFromUpstreamEdge(nodes, edges, "down");
    expect(wired?.configPatch.table).toBe("staging.raw");
    expect(wired?.configPatch._preview_nonce).toBeDefined();
  });
});
