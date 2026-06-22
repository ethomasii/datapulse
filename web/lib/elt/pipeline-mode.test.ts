import { describe, expect, it } from "vitest";
import {
  isTransformOnlyPipeline,
  minimalTransformOnlySourceConfiguration,
  readTransformOnlySourceTable,
  transformOnlyCanvasGraph,
} from "@/lib/elt/pipeline-mode";

describe("pipeline-mode", () => {
  it("detects transform-only mode", () => {
    expect(isTransformOnlyPipeline({ elt_pipeline_mode: "transform_only" })).toBe(true);
    expect(isTransformOnlyPipeline({})).toBe(false);
  });

  it("builds warehouse-only canvas", () => {
    const g = transformOnlyCanvasGraph({
      warehouseLabel: "Prod Snowflake",
      sourceTable: "staging.orders",
    });
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0]?.type).toBe("destNode");
    expect(g.edges).toHaveLength(0);
  });

  it("reads source table with fallback", () => {
    expect(readTransformOnlySourceTable({ source_table: "raw.events" })).toBe("raw.events");
    expect(readTransformOnlySourceTable({})).toBe("staging.events");
  });

  it("minimal config includes mode and table", () => {
    const cfg = minimalTransformOnlySourceConfiguration("marts.orders");
    expect(cfg.elt_pipeline_mode).toBe("transform_only");
    expect(cfg.source_table).toBe("marts.orders");
  });
});
