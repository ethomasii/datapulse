import { describe, expect, it } from "vitest";
import { applyCanvasGraphEdits } from "@/lib/elt/canvas-graph-edit";

describe("canvas-graph-edit", () => {
  const baseConfig = {
    canvas: {
      v: 1,
      nodes: [
        { id: "n1", type: "sourceNode", position: { x: 0, y: 0 }, data: { label: "Extract" } },
        { id: "n2", type: "destNode", position: { x: 400, y: 0 }, data: { label: "Load" } },
        {
          id: "n3",
          type: "componentNode",
          position: { x: 200, y: -80 },
          data: { componentId: "join_tables", label: "join", category: "transformation", compileTarget: "python" },
        },
        {
          id: "n4",
          type: "componentNode",
          position: { x: 200, y: 80 },
          data: { componentId: "filter_rows", label: "filter", category: "transformation", compileTarget: "python" },
        },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    },
  };

  it("connects nodes by label", () => {
    const r = applyCanvasGraphEdits(
      baseConfig,
      [{ op: "connect", source: "join", target: "filter" }],
      { sourceType: "github", destinationType: "snowflake" }
    );
    expect(r.errors).toHaveLength(0);
    expect(r.messages[0]).toContain("join");
    const edgePairs = (r.canvas.edges as { source: string; target: string }[]).map(
      (e) => `${e.source}->${e.target}`
    );
    expect(edgePairs).toContain("n3->n4");
  });

  it("adds dbt transform after dest", () => {
    const r = applyCanvasGraphEdits(
      baseConfig,
      [{ op: "add_transform", tool: "dbt", label: "staging models", after: "dest" }],
      { sourceType: "github", destinationType: "snowflake" }
    );
    expect(r.errors).toHaveLength(0);
    expect(r.messages[0]).toContain("dbt");
    const transform = (r.canvas.nodes as { type?: string }[]).find((n) => n.type === "transformNode");
    expect(transform).toBeDefined();
  });
});
