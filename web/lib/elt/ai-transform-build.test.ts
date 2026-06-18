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

  it("builds dbt warehouse component chain", () => {
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
    expect(result.components).toHaveLength(2);
    expect(result.components[0]?.config?.execution).toBe("warehouse");
    expect(result.graph_edits.length).toBeGreaterThan(0);
  });

  it("infers dbt mode from warehouse and lake keywords", () => {
    expect(inferTransformMode("push down aggregate in snowflake")).toBe("dbt");
    expect(inferTransformMode("single lake medallion")).toBe("dbt");
    expect(inferTransformMode("quick dataframe filter")).toBe("dataframe");
  });
});
