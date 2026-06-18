import { describe, expect, it } from "vitest";
import { compileNativePipelineComponents } from "@/lib/elt/native-components/compile-pipeline-components";
import { joinTablesComponent } from "@/lib/elt/native-components/definitions/join-tables";
import { dqCheckComponent } from "@/lib/elt/native-components/definitions/dq-check";
import { getNativeComponent, isNativeComponent, listNativeComponents } from "@/lib/elt/native-components/registry";
import { dagsterAttributesToFields } from "@/lib/elt/native-components/dagster-schema";

describe("native-components", () => {
  it("resolves aliases", () => {
    expect(isNativeComponent("join_tables")).toBe(true);
    expect(isNativeComponent("dataframe_join")).toBe(true);
    expect(getNativeComponent("dataframe_join")?.id).toBe("join_tables");
  });

  it("join_tables emits pandas merge python", () => {
    const out = joinTablesComponent.compile({
      left_table: "staging.orders",
      right_table: "staging.customers",
      on: ["customer_id"],
      output_table: "staging.orders_enriched",
      how: "left",
    });
    expect(out.python?.join("\n")).toContain("merge");
    expect(out.python?.join("\n")).toContain("staging.orders");
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
    expect(pt.type).toBe("python");
    expect(pt.code).toContain("join_tables");
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

  it("lists 33 native components", () => {
    expect(listNativeComponents().length).toBe(33);
  });
});
