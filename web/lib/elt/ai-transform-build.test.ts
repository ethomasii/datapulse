import { describe, expect, it } from "vitest";
import {
  buildTransformPipeline,
  inferTransformMode,
  normalizeTransformBuildMode,
  pandasConditionToSql,
} from "@/lib/elt/ai-transform-build";

describe("ai-transform-build", () => {
  it("converts pandas condition to SQL", () => {
    expect(pandasConditionToSql("status == 'active' and amount > 0")).toBe(
      "status = 'active' AND amount > 0"
    );
  });

  it("builds dataframe filter + sort chain", () => {
    const result = buildTransformPipeline({
      mode: "dataframe",
      source_table: "staging.orders",
      steps: [
        { op: "filter", condition: "status == 'active'" },
        { op: "sort", columns: ["created_at"], ascending: false },
      ],
    });
    expect(result.components).toHaveLength(2);
    expect(result.components[0]?.component_id).toBe("filter_rows");
    expect(result.components[1]?.component_id).toBe("sort_rows");
    expect(result.components[0]?.config?.table).toBe("staging.orders");
  });

  it("builds warehouse SQL component chain", () => {
    const result = buildTransformPipeline({
      mode: "warehouse",
      source_table: "staging.orders",
      steps: [
        { op: "filter", condition: "status == 'paid'" },
        {
          op: "aggregate",
          group_by: ["date"],
          aggregations: { amount: "sum", id: "count" },
        },
      ],
    });
    expect(result.mode).toBe("warehouse");
    expect(result.components).toHaveLength(2);
    expect(result.components[0]?.config?.execution).toBe("warehouse");
    expect(result.graph_edits.length).toBeGreaterThan(0);
  });

  it("legacy dbt mode without package resolves to warehouse", () => {
    const result = buildTransformPipeline({
      mode: "warehouse",
      source_table: "staging.orders",
      steps: [{ op: "filter", condition: "status == 'paid'" }],
    });
    expect(result.mode).toBe("warehouse");
    expect(result.components[0]?.config?.execution).toBe("warehouse");
  });

  it("infers dbt as default; warehouse for recipes; dataframe as legacy", () => {
    expect(inferTransformMode("push down aggregate in snowflake")).toBe("dbt");
    expect(inferTransformMode("filter and sort after load")).toBe("dbt");
    expect(inferTransformMode("single lake medallion recipe")).toBe("warehouse");
    expect(inferTransformMode("build_lake_pipeline medallion")).toBe("warehouse");
    expect(inferTransformMode("legacy pandas dataframe filter")).toBe("dataframe");
    expect(inferTransformMode("", "https://github.com/o/dbt.git")).toBe("dbt");
  });

  it("maps legacy dbt mode to warehouse without package", () => {
    expect(normalizeTransformBuildMode("dbt")).toBe("warehouse");
    expect(normalizeTransformBuildMode("dbt", { dbtPackagePath: "./dbt" })).toBe("dbt");
  });
});
