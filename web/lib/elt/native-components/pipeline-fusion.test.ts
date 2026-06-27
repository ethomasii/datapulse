import { describe, expect, it } from "vitest";
import {
  ELT_SCRATCH_SCHEMA,
  scratchOutputTables,
  toScratchTable,
} from "./eltpulse-scratch";
import { analyzePipelineFusion } from "./pipeline-fusion-analysis";
import { buildFusedPreviewSelect } from "./pipeline-fusion-preview";
import { compileNativePipelineComponents } from "./compile-pipeline-components";

describe("eltpulse scratch schema", () => {
  it("maps intermediate outputs to scratch tables", () => {
    const map = scratchOutputTables(
      [
        {
          id: "filter1",
          config: { output_table: "gold.orders_filtered", materialization: "ephemeral" },
        },
        {
          id: "agg1",
          config: {
            output_table: "gold.orders_daily",
            materialization: "table",
            table: "gold.orders_filtered",
          },
        },
      ],
      { pipelineName: "My Pipeline" }
    );
    expect(map.get("gold.orders_filtered")).toMatch(
      new RegExp(`^${ELT_SCRATCH_SCHEMA}\\.my_pipeline__`)
    );
    expect(map.has("gold.orders_daily")).toBe(false);
  });

  it("rewrites compile output to scratch for intermediates", () => {
    const { result, config } = compileNativePipelineComponents({
      pipeline_name: "demo",
      elt_sql_fusion: false,
      elt_components: [
        {
          id: "f1",
          type: "sql",
          config: {
            template_id: "filter_rows",
            table: "bronze.orders",
            output_table: "gold.step_a",
            materialization: "ephemeral",
            condition: "1=1",
          },
        },
        {
          id: "f2",
          type: "sql",
          after: ["f1"],
          config: {
            template_id: "filter_rows",
            table: "gold.step_a",
            output_table: "gold.step_b",
            materialization: "table",
            condition: "1=1",
          },
        },
      ],
    });
    expect(config.elt_scratch_tables).toBeDefined();
    const ctas = result.sqlStatements.filter((s) => /CREATE\s+(OR\s+REPLACE\s+)?TABLE/i.test(s));
    expect(ctas.some((s) => s.includes(ELT_SCRATCH_SCHEMA))).toBe(true);
    expect(result.sqlStatements[0]).toContain("CREATE SCHEMA IF NOT EXISTS");
  });
});

describe("pipeline fusion analysis", () => {
  it("reports fused segments for linear warehouse chain", () => {
    const analysis = analyzePipelineFusion({
      elt_components: [
        {
          id: "a",
          type: "sql",
          config: {
            template_id: "filter_rows",
            table: "bronze.t",
            output_table: "gold.a",
            condition: "1=1",
          },
        },
        {
          id: "b",
          type: "sql",
          after: ["a"],
          config: {
            template_id: "filter_rows",
            table: "gold.a",
            output_table: "gold.b",
            condition: "1=1",
          },
        },
      ],
    });
    expect(analysis.segments.some((s) => s.kind === "fused_sql")).toBe(true);
    expect(analysis.tablesAtRun).toBeLessThan(analysis.tablesWithoutFusion);
  });
});

describe("fused preview select", () => {
  it("builds SELECT for subgraph through step", () => {
    const components = [
      {
        id: "a",
        type: "sql" as const,
        config: {
          template_id: "filter_rows",
          table: "bronze.t",
          output_table: "gold.a",
          filter: "1=1",
        },
      },
      {
        id: "b",
        type: "sql" as const,
        after: ["a"],
        config: {
          template_id: "filter_rows",
          table: "gold.a",
          output_table: "gold.b",
          filter: "1=1",
        },
      },
    ];
    const preview = buildFusedPreviewSelect(components, "b", 10);
    expect(preview?.sql).toMatch(/^SELECT/i);
    expect(preview?.sql).toContain("LIMIT 10");
    expect(preview?.fusedSteps).toBeGreaterThanOrEqual(1);
  });
});

describe("toScratchTable", () => {
  it("slugifies pipeline name", () => {
    expect(toScratchTable("gold.orders", "Sales Pipeline!")).toBe(
      `${ELT_SCRATCH_SCHEMA}.sales_pipeline__orders`
    );
  });
});
