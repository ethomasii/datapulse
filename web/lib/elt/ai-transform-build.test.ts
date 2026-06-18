import { describe, expect, it } from "vitest";
import {
  buildTransformPipeline,
  inferTransformMode,
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

  it("builds dbt SQL push-down aggregate", () => {
    const result = buildTransformPipeline({
      mode: "dbt",
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
    expect(result.post_transform_type).toBe("sql");
    expect(result.post_transform_code).toContain("CREATE OR REPLACE TABLE");
    expect(result.post_transform_code).toContain("GROUP BY");
    expect(result.graph_edits.some((e) => e.op === "add_transform")).toBe(true);
  });

  it("infers dbt mode from warehouse keywords", () => {
    expect(inferTransformMode("push down aggregate in snowflake")).toBe("dbt");
    expect(inferTransformMode("filter active rows")).toBe("dataframe");
  });
});
