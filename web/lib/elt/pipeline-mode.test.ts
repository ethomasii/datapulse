import { describe, expect, it } from "vitest";
import {
  isTransformOnlyPipeline,
  minimalTransformOnlySourceConfiguration,
  transformOnlyCanvasGraph,
} from "@/lib/elt/pipeline-mode";

describe("pipeline-mode", () => {
  it("detects transform-only mode", () => {
    expect(isTransformOnlyPipeline({ elt_pipeline_mode: "transform_only" })).toBe(true);
    expect(isTransformOnlyPipeline({})).toBe(false);
  });

  it("builds warehouse-only canvas without a default input table", () => {
    const g = transformOnlyCanvasGraph({ warehouseLabel: "Prod Snowflake" });
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0]?.type).toBe("destNode");
    expect(g.edges).toHaveLength(0);
    expect((g.nodes[0]?.data as Record<string, unknown>).sourceTable).toBeUndefined();
  });

  it("minimal config is mode + optional canvas only", () => {
    const cfg = minimalTransformOnlySourceConfiguration();
    expect(cfg.elt_pipeline_mode).toBe("transform_only");
    expect(cfg.source_table).toBeUndefined();
  });
});
