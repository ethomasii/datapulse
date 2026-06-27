import { describe, expect, it } from "vitest";
import {
  assertReadOnlySql,
  quoteQualifiedTable,
  sampleSelectSql,
} from "@/lib/elt/warehouse-readonly-query";

describe("assertReadOnlySql", () => {
  it("allows SELECT and WITH", () => {
    expect(() => assertReadOnlySql("SELECT 1")).not.toThrow();
    expect(() => assertReadOnlySql("WITH cte AS (SELECT 1) SELECT * FROM cte")).not.toThrow();
  });

  it("rejects mutating statements", () => {
    expect(() => assertReadOnlySql("DELETE FROM t")).toThrow(/SELECT/);
    expect(() => assertReadOnlySql("SELECT 1; DROP TABLE t")).toThrow(/forbidden/i);
  });
});

describe("quoteQualifiedTable", () => {
  it("quotes BigQuery and MySQL identifiers", () => {
    expect(quoteQualifiedTable("bigquery", "ds", "tbl")).toBe("`ds.tbl`");
    expect(quoteQualifiedTable("mysql", "mydb", "users")).toBe("`mydb`.`users`");
  });

  it("uses double quotes for DuckDB-style engines", () => {
    expect(quoteQualifiedTable("motherduck", "main", "issues")).toBe('"main"."issues"');
    expect(quoteQualifiedTable("duckdb", "main", 'say"hi')).toBe('"main"."say""hi"');
  });

  it("normalizes gcp to BigQuery quoting", () => {
    expect(quoteQualifiedTable("gcp", "ds", "tbl")).toBe("`ds.tbl`");
  });
});

describe("sampleSelectSql", () => {
  it("builds dialect-appropriate sample queries", () => {
    expect(sampleSelectSql("postgres", "public", "users", 5)).toBe(
      "SELECT * FROM public.users LIMIT 5"
    );
    expect(sampleSelectSql("clickhouse", "default", "events", 10)).toBe(
      "SELECT * FROM `default`.`events` LIMIT 10"
    );
    expect(sampleSelectSql("databricks", "catalog.schema", "tbl", 3)).toBe(
      "SELECT * FROM catalog.schema.tbl LIMIT 3"
    );
  });
});
