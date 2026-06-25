import { describe, expect, it } from "vitest";
import { defaultPipelineCanvasBackbone } from "@/lib/elt/spec-components-to-canvas";

describe("defaultPipelineCanvasBackbone", () => {
  it("builds source and destination nodes for connector-sync pipelines", () => {
    const canvas = defaultPipelineCanvasBackbone("github", "duckdb");
    expect(canvas.nodes.some((n) => n.type === "sourceNode")).toBe(true);
    expect(canvas.nodes.some((n) => n.type === "destNode")).toBe(true);
    expect(canvas.edges.length).toBeGreaterThan(0);
    expect(canvas.nodes.some((n) => n.type === "componentNode")).toBe(false);
  });
});
