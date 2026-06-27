import { describe, expect, it } from "vitest";
import { duckdbColumnsSql } from "./warehouse-column-introspect";

describe("duckdbColumnsSql", () => {
  it("queries duckdb_columns for schema.table (MotherDuck primary path)", () => {
    const sql = duckdbColumnsSql("github_dlt_hub_dlt", "issues");
    expect(sql).toContain("duckdb_columns()");
    expect(sql).toContain("github_dlt_hub_dlt");
    expect(sql).toContain("issues");
    expect(sql).toContain("column_type AS data_type");
    expect(sql).toContain("ORDER BY column_index");
  });
});
