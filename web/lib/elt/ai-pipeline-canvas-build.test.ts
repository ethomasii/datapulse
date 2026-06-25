import { describe, expect, it } from "vitest";
import {
  applyCanvasComponentsToSourceConfig,
  buildPipelineCanvasFromComponents,
  relayoutPipelineCanvas,
} from "@/lib/elt/ai-pipeline-canvas-build";
import { extractComponentsFromCanvas } from "@/lib/elt/canvas-component-sync";

describe("ai-pipeline-canvas-build", () => {
  it("builds source → dest backbone with quality after dest", () => {
    const { nodes, edges } = buildPipelineCanvasFromComponents({
      sourceType: "github",
      destinationType: "snowflake",
      components: [
        {
          component_id: "dq_check",
          config: { table: "issues", not_null: ["id"] },
        },
      ],
    });

    expect(nodes.some((n) => n.type === "sourceNode")).toBe(true);
    expect(nodes.some((n) => n.type === "destNode")).toBe(true);
    expect(nodes.filter((n) => n.type === "componentNode")).toHaveLength(1);

    const dest = nodes.find((n) => n.type === "destNode")!;
    const quality = nodes.find((n) => n.type === "componentNode")!;
    expect(edges.some((e) => e.source === dest.id && e.target === quality.id)).toBe(true);

    const extracted = extractComponentsFromCanvas(nodes, edges);
    expect(extracted.quality[0]?.table).toBe("issues");
  });

  it("places s3 monitor as parallel branch from source", () => {
    const { nodes, edges } = buildPipelineCanvasFromComponents({
      sourceType: "github",
      destinationType: "snowflake",
      components: [{ component_id: "s3_monitor", config: { prefix: "s3://bucket/in/" } }],
    });

    const source = nodes.find((n) => n.type === "sourceNode")!;
    const monitor = nodes.find((n) => n.type === "componentNode")!;
    expect(edges.some((e) => e.source === source.id && e.target === monitor.id)).toBe(true);
    expect(edges.some((e) => e.source === source.id && e.target !== monitor.id)).toBe(true);
  });

  it("merges new components into existing canvas", () => {
    const existing = buildPipelineCanvasFromComponents({
      sourceType: "github",
      destinationType: "snowflake",
      components: [{ component_id: "s3_monitor" }],
    });

    const merged = buildPipelineCanvasFromComponents({
      existingCanvas: { nodes: existing.nodes, edges: existing.edges, v: 1 },
      components: [{ component_id: "dq_check", config: { table: "orders", not_null: ["id"] } }],
    });

    expect(merged.nodes.filter((n) => n.type === "componentNode")).toHaveLength(2);
  });

  it("applyCanvasComponentsToSourceConfig writes elt_components", () => {
    const result = applyCanvasComponentsToSourceConfig(
      {},
      {
        sourceType: "github",
        destinationType: "snowflake",
        components: [{ component_id: "dq_check", config: { table: "t", not_null: ["id"] } }],
      }
    );

    expect(result.canvas.nodes.length).toBeGreaterThan(2);
    expect(Array.isArray(result.sourceConfiguration.elt_components)).toBe(true);
    expect(result.skippedComponents).toHaveLength(0);
  });

  it("relayoutPipelineCanvas separates nodes on the main chain", () => {
    const { nodes, edges } = buildPipelineCanvasFromComponents({
      sourceType: "github",
      destinationType: "duckdb",
      components: [
        { component_id: "select_columns", config: { columns: ["id"] } },
        { component_id: "filter_rows", config: { condition: "id is not null" } },
        { component_id: "aggregate", config: { group_by: ["id"], metrics: [] } },
      ],
    });
    const xs = nodes.map((n) => n.position.x);
    const uniqueXs = new Set(xs);
    expect(uniqueXs.size).toBe(xs.length);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(40);
    const positions = nodes.map((n) => `${n.position.x},${n.position.y}`);
    expect(new Set(positions).size).toBe(positions.length);
  });
});
