import { describe, expect, it } from "vitest";
import {
  pandasQueryToSqlWhere,
  sqlCreateTableAs,
  sqlQualifiedTable,
  useDataframeExecution,
} from "./_sql-helpers";

describe("_sql-helpers", () => {
  it("quotes qualified table names", () => {
    expect(sqlQualifiedTable("staging.orders")).toBe('"staging"."orders"');
  });

  it("builds CTAS", () => {
    expect(sqlCreateTableAs("marts.segments", "SELECT 1")).toContain(
      'CREATE OR REPLACE TABLE "marts"."segments" AS'
    );
  });

  it("converts simple pandas filters", () => {
    expect(pandasQueryToSqlWhere("status == 'active' and amount > 0")).toContain("status");
    expect(pandasQueryToSqlWhere("status == 'active' and amount > 0")).toContain("AND");
  });

  it("detects dataframe execution mode", () => {
    expect(useDataframeExecution({ execution: "dataframe" })).toBe(true);
    expect(useDataframeExecution({})).toBe(false);
  });
});
