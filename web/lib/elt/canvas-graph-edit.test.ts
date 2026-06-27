import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { applyCanvasGraphEdits } from "@/lib/elt/canvas-graph-edit";
import { CANVAS_HORIZONTAL_GAP } from "@/lib/elt/canvas-node-placement";

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

  it("merges config on update_node_config", () => {
    const r = applyCanvasGraphEdits(
      baseConfig,
      [
        {
          op: "update_node_config",
          node: "n4",
          config: { condition: "status = 'active'", columns: ["id", "status"] },
        },
      ],
      { sourceType: "github", destinationType: "snowflake" }
    );
    expect(r.errors).toHaveLength(0);
    const filter = (r.canvas.nodes as { id: string; data: { config?: Record<string, unknown> } }[]).find(
      (n) => n.id === "n4"
    );
    expect(filter?.data.config?.condition).toBe("status = 'active'");
    expect(r.canvas.nodes).toHaveLength(4);
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

  it("appends Pulse AI-added components after the pipeline tail with layout spacing", () => {
    const chainConfig = {
      canvas: {
        v: 1,
        nodes: [
          { id: "s", type: "sourceNode", position: { x: 40, y: 120 }, data: {} },
          { id: "d", type: "destNode", position: { x: 360, y: 120 }, data: {} },
          {
            id: "c1",
            type: "componentNode",
            position: { x: 648, y: 120 },
            data: {
              componentId: "alter_row",
              compileHint: "Warehouse SQL or dataframe transform after load",
              category: "transformation",
            },
          },
        ],
        edges: [
          { id: "e1", source: "s", target: "d" },
          { id: "e2", source: "d", target: "c1" },
        ],
      },
    };
    const r = applyCanvasGraphEdits(
      chainConfig,
      [{ op: "add_component", component_id: "databricks_genie_query", label: "Genie" }],
      { sourceType: "github", destinationType: "snowflake" }
    );
    expect(r.errors).toHaveLength(0);
    const nodes = r.canvas.nodes as Node[];
    const genie = nodes.find(
      (n) => String((n.data as { componentId?: string }).componentId) === "databricks_genie_query"
    );
    const alterRow = nodes.find((n) => n.id === "c1");
    expect(genie).toBeDefined();
    expect(alterRow).toBeDefined();
    expect(genie!.position.x).toBeGreaterThan(alterRow!.position.x);
    expect(genie!.position.x - alterRow!.position.x).toBeGreaterThanOrEqual(200 + CANVAS_HORIZONTAL_GAP - 8);
    const edgePairs = (r.canvas.edges as { source: string; target: string }[]).map(
      (e) => `${e.source}->${e.target}`
    );
    expect(edgePairs).toContain(`c1->${genie!.id}`);
  });

  it("replaces a component in place for Pulse AI swap requests", () => {
    const r = applyCanvasGraphEdits(
      {
        canvas: {
          v: 1,
          nodes: [
            { id: "d", type: "destNode", position: { x: 360, y: 120 }, data: {} },
            {
              id: "c1",
              type: "componentNode",
              position: { x: 648, y: 120 },
              data: {
                componentId: "data_cleansing",
                label: "Data cleansing",
                category: "transformation",
                compileHint: "Trim, lowercase, drop null rows",
              },
            },
          ],
          edges: [{ id: "e1", source: "d", target: "c1" }],
        },
      },
      [
        {
          op: "replace_component",
          node: "data_cleansing",
          component_id: "alter_row",
          label: "Alter row (CDC)",
        },
      ],
      { sourceType: "github", destinationType: "snowflake" }
    );
    expect(r.errors).toHaveLength(0);
    const swapped = (r.canvas.nodes as Node[]).find((n) => n.id === "c1");
    expect((swapped?.data as { componentId?: string }).componentId).toBe("alter_row");
    expect(r.messages[0]).toContain("alter_row");
  });
});
