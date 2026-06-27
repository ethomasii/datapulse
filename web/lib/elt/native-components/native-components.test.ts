import { describe, expect, it } from "vitest";
import { compileNativePipelineComponents } from "@/lib/elt/native-components/compile-pipeline-components";
import { joinTablesComponent } from "@/lib/elt/native-components/definitions/join-tables";
import { dqCheckComponent } from "@/lib/elt/native-components/definitions/dq-check";
import { getNativeComponent, isNativeComponent, listNativeComponents } from "@/lib/elt/native-components/registry";
import { dagsterAttributesToFields } from "@/lib/elt/native-components/dagster-schema";
import { minimalNativeConfig } from "@/lib/elt/native-components/minimal-config";
import type { NativeComponentCompileResult } from "@/lib/elt/native-components/types";

describe("native-components", () => {
  it("resolves aliases", () => {
    expect(isNativeComponent("join_tables")).toBe(true);
    expect(isNativeComponent("dataframe_join")).toBe(true);
    expect(getNativeComponent("dataframe_join")?.id).toBe("join_tables");
  });

  it("join_tables emits warehouse SQL by default", () => {
    const out = joinTablesComponent.compile({
      left_table: "staging.orders",
      right_table: "staging.customers",
      on: ["customer_id"],
      output_table: "staging.orders_enriched",
      how: "left",
    });
    expect(out.sql?.join("\n")).toContain("LEFT JOIN");
    expect(out.sql?.join("\n")).toContain('"staging"."orders"');
    expect(out.python).toBeUndefined();
  });

  it("join_tables dataframe mode emits pandas merge", () => {
    const out = joinTablesComponent.compile({
      left_table: "staging.orders",
      right_table: "staging.customers",
      on: ["customer_id"],
      output_table: "staging.orders_enriched",
      how: "left",
      execution: "dataframe",
    });
    expect(out.python?.join("\n")).toContain("merge");
  });

  it("dq_check emits test lines", () => {
    const out = dqCheckComponent.compile({
      table: "orders",
      not_null: ["id"],
    });
    expect(out.tests).toContain("orders.id not_null");
  });

  it("compileNativePipelineComponents merges into post_transform", () => {
    const { config, result } = compileNativePipelineComponents({
      elt_components: [
        {
          id: "join_step",
          type: "python",
          config: {
            template_id: "join_tables",
            left_table: "a",
            right_table: "b",
            on: ["id"],
            output_table: "c",
          },
        },
      ],
    });
    expect(result.compiled).toBe(true);
    const pt = config.post_transform as { type: string; code: string };
    expect(pt.type).toBe("sql");
    expect(pt.code).toContain("JOIN");
  });

  it("fuses linear warehouse SQL steps into one CTAS", () => {
    const { config, result } = compileNativePipelineComponents({
      elt_components: [
        {
          id: "filter_1",
          type: "python",
          config: {
            template_id: "filter_rows",
            table: "staging.raw",
            condition: "id > 0",
            output_table: "staging.filtered",
          },
        },
        {
          id: "filter_2",
          type: "python",
          config: {
            template_id: "filter_rows",
            table: "staging.filtered",
            condition: "amount > 10",
            output_table: "staging.final",
          },
        },
      ],
    });
    expect(result.sqlStatements).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes("Fused 2 warehouse SQL"))).toBe(true);
    const pt = config.post_transform as { code: string };
    expect(pt.code).toContain("amount > 10");
    expect(pt.code).toContain("id > 0");
    expect((pt.code.match(/CREATE OR REPLACE TABLE/gi) ?? []).length).toBe(1);
  });

  it("breaks SQL fusion at Python agent steps", () => {
    const { result } = compileNativePipelineComponents({
      elt_components: [
        {
          id: "filter_1",
          type: "python",
          config: {
            template_id: "filter_rows",
            table: "staging.raw",
            condition: "id > 0",
            output_table: "staging.filtered",
          },
        },
        {
          id: "agent",
          type: "python",
          config: {
            template_id: "litellm_inference_asset",
            table: "staging.filtered",
            output_table: "staging.enriched",
            prompt: "summarize",
            model: "gpt-4o-mini",
          },
        },
        {
          id: "filter_2",
          type: "python",
          config: {
            template_id: "filter_rows",
            table: "staging.enriched",
            condition: "score > 0",
            output_table: "staging.final",
          },
        },
      ],
    });
    expect(result.sqlStatements.length).toBeGreaterThanOrEqual(2);
    expect(result.pythonBlocks.length).toBeGreaterThan(0);
  });

  it("dagsterAttributesToFields skips partition metadata", () => {
    const fields = dagsterAttributesToFields({
      left_table: { type: "string", label: "Left table", required: true },
      partition_type: { type: "string", label: "Partition", enum: ["daily"] },
      on: { type: "array", items: { type: "string" }, "ui:widget": "list", label: "On" },
    });
    expect(fields.map((f) => f.key)).toEqual(["left_table", "on"]);
  });

  it("sql_transform emits SQL statements", async () => {
    const { compileNativePipelineComponents } = await import(
      "@/lib/elt/native-components/compile-pipeline-components"
    );
    const { config, result } = compileNativePipelineComponents({
      elt_components: [
        {
          id: "sql1",
          type: "python",
          config: { template_id: "sql_transform", sql: "REFRESH MATERIALIZED VIEW mv_orders;" },
        },
      ],
    });
    expect(result.compiled).toBe(true);
    const pt = config.post_transform as { code: string };
    expect(pt.code).toContain("REFRESH MATERIALIZED VIEW");
  });

  it("s3_monitor patches elt_canvas_sensors", async () => {
    const { compileNativePipelineComponents } = await import(
      "@/lib/elt/native-components/compile-pipeline-components"
    );
    const { config } = compileNativePipelineComponents({
      elt_components: [
        {
          id: "mon",
          type: "custom",
          config: {
            template_id: "s3_monitor",
            bucket_name: "my-bucket",
            prefix: "in/",
          },
        },
      ],
    });
    const sensors = config.elt_canvas_sensors as unknown[];
    expect(Array.isArray(sensors)).toBe(true);
    expect(sensors.length).toBe(1);
  });

  it("lists 74 native components", () => {
    expect(listNativeComponents().length).toBe(74);
  });

  it("every native component compile() emits output without throwing", () => {
    const natives = listNativeComponents();
    const failures: string[] = [];

    function hasOutput(result: NativeComponentCompileResult): boolean {
      if (result.python?.some((line) => line.trim())) return true;
      if (result.sql?.some((line) => line.trim())) return true;
      if (result.tests?.length) return true;
      if (result.quality?.length) return true;
      if (result.configPatch && Object.keys(result.configPatch).length > 0) return true;
      return false;
    }

    for (const def of natives) {
      try {
        const out = def.compile(minimalNativeConfig(def));
        if (!hasOutput(out)) {
          failures.push(`${def.id}: compile returned no python/sql/tests/quality/configPatch`);
        }
      } catch (err) {
        failures.push(`${def.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("hash emits hashlib python", () => {
    const def = getNativeComponent("hash");
    const out = def!.compile({ table: "t", columns: ["a", "b"], output_table: "t_hashed" });
    expect(out.python?.join("\n")).toContain("hashlib");
  });

  it("router resolves as native", () => {
    expect(isNativeComponent("router")).toBe(true);
    expect(isNativeComponent("conditional_split")).toBe(true);
  });

  it("scd_type_2 resolves as native", () => {
    expect(isNativeComponent("scd_type_2")).toBe(true);
  });

  it("hl7_v2_parser emits segment parsing python", () => {
    const def = getNativeComponent("hl7_v2_parser");
    expect(def?.id).toBe("hl7_v2_parser");
    const out = def!.compile({
      table: "staging.hl7_messages",
      message_column: "message",
      keep_segments: ["MSH", "PID", "OBX"],
      output_table: "staging.hl7_segments",
    });
    const code = out.python?.join("\n") ?? "";
    expect(code).toContain("_hl7_parse_message");
    expect(code).toContain("MSH");
    expect(code).toContain("staging.hl7_segments");
  });

  it("resolves catalog aliases to native compilers", () => {
    expect(isNativeComponent("summarize")).toBe(true);
    expect(getNativeComponent("summarize")?.id).toBe("group_aggregate");
    expect(isNativeComponent("unpivot")).toBe(true);
    expect(isNativeComponent("melt")).toBe(true);
    expect(getNativeComponent("melt")?.id).toBe("unpivot");
    expect(isNativeComponent("left_join")).toBe(true);
    expect(isNativeComponent("gcs_to_database_asset")).toBe(true);
  });
});
