import { describe, expect, it } from "vitest";
import { parseDuckdbTableRef, stripDuckdbCatalogPrefix } from "./duckdb-table-ref";

describe("parseDuckdbTableRef", () => {
  it("parses schema.table with default database", () => {
    expect(parseDuckdbTableRef("github_dlt_hub_dlt.issues", "my_db")).toEqual({
      database: "my_db",
      schema: "github_dlt_hub_dlt",
      table: "issues",
      qualified: "github_dlt_hub_dlt.issues",
    });
  });

  it("parses database.schema.table and prefers catalog from ref", () => {
    expect(parseDuckdbTableRef("my_db.github_dlt_hub_dlt.issues", "eltpulse")).toEqual({
      database: "my_db",
      schema: "github_dlt_hub_dlt",
      table: "issues",
      qualified: "github_dlt_hub_dlt.issues",
    });
  });
});

describe("stripDuckdbCatalogPrefix", () => {
  it("strips catalog from 3-part refs", () => {
    expect(stripDuckdbCatalogPrefix("my_db.github_dlt_hub_dlt.issues")).toBe(
      "github_dlt_hub_dlt.issues"
    );
  });

  it("leaves 2-part refs unchanged", () => {
    expect(stripDuckdbCatalogPrefix("github_dlt_hub_dlt.issues")).toBe("github_dlt_hub_dlt.issues");
  });
});
