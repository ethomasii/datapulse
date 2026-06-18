import { describe, expect, it } from "vitest";
import { buildLakePipeline, matchLakeStarter } from "./lake-pipeline-starters";

describe("lake-pipeline-starters", () => {
  it("matches single lake medallion trigger", () => {
    expect(matchLakeStarter("build a medallion on one ingested table")?.id).toBe("single_lake_medallion");
  });

  it("builds single source to mart chain", () => {
    const out = buildLakePipeline({
      starter_id: "single_source_to_mart",
      source_table: "staging.orders",
    });
    expect(out.components).toHaveLength(3);
    expect(out.components[0]?.component_id).toBe("select_columns");
    expect(out.components[1]?.component_id).toBe("filter_rows");
    expect(out.graph_edits.length).toBeGreaterThan(0);
  });

  it("builds entity 360 with custom dimension", () => {
    const out = buildLakePipeline({
      starter_id: "entity_360_profile",
      source_table: "staging.events",
      dimension_table: "dims.accounts",
      join_key: "account_id",
    });
    expect(out.components[0]?.config?.right_table).toBe("dims.accounts");
    expect(out.components[1]?.config?.group_by).toEqual(["account_id"]);
  });
});
