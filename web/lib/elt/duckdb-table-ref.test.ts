import { describe, expect, it } from "vitest";
import { parseDuckdbTableRef, stripDuckdbCatalogPrefix, attachDuckdbCatalog, duckdbCatalogFromRef } from "./duckdb-table-ref";

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

describe("duckdbCatalogFromRef", () => {
  it("returns catalog from 3-part refs", () => {
    expect(duckdbCatalogFromRef("my_db.github_dlt_hub_dlt.issues")).toBe("my_db");
  });

  it("returns undefined for 2-part refs", () => {
    expect(duckdbCatalogFromRef("github_dlt_hub_dlt.issues")).toBeUndefined();
  });
});

describe("attachDuckdbCatalog", () => {
  it("reattaches catalog to resolved 2-part refs", () => {
    expect(attachDuckdbCatalog("github_dlt_hub_dlt.issues", "my_db")).toBe(
      "my_db.github_dlt_hub_dlt.issues"
    );
  });

  it("leaves existing 3-part refs unchanged", () => {
    expect(attachDuckdbCatalog("my_db.github_dlt_hub_dlt.issues", "eltpulse")).toBe(
      "my_db.github_dlt_hub_dlt.issues"
    );
  });
});
