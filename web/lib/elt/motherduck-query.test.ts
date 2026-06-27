import { describe, expect, it } from "vitest";
import {
  motherduckQueryPayload,
  motherduckScopedSql,
  parseMotherduckSqlResponse,
} from "@/lib/elt/warehouse-introspect-connectors";

describe("parseMotherduckSqlResponse", () => {
  it("maps columns and rows from MotherDuck SQL API shape", () => {
    const parsed = parseMotherduckSqlResponse({
      columns: [{ name: "id" }, { name: "name" }],
      rows: [
        [1, "alpha"],
        [2, "beta"],
      ],
    });
    expect(parsed.columns).toEqual(["id", "name"]);
    expect(parsed.rows).toHaveLength(2);
  });

  it("accepts string column names", () => {
    const parsed = parseMotherduckSqlResponse({
      columns: ["id", "title"],
      rows: [[1, "a"]],
    });
    expect(parsed.columns).toEqual(["id", "title"]);
  });

  it("falls back to col_N when column metadata is missing", () => {
    const parsed = parseMotherduckSqlResponse({
      data: [[10, 20]],
    });
    expect(parsed.columns).toEqual(["col_0", "col_1"]);
    expect(parsed.rows[0]).toEqual([10, 20]);
  });

  it("reads fields metadata when rows are empty", () => {
    const parsed = parseMotherduckSqlResponse({
      fields: [{ name: "number" }, { name: "title" }],
      rows: [],
    });
    expect(parsed.columns).toEqual(["number", "title"]);
  });

  it("normalizes object-shaped rows from information_schema-style responses", () => {
    const parsed = parseMotherduckSqlResponse({
      columns: ["column_name", "data_type"],
      rows: [
        { column_name: "number", data_type: "BIGINT" },
        { column_name: "title", data_type: "VARCHAR" },
      ],
    });
    expect(parsed.columns).toEqual(["column_name", "data_type"]);
    expect(parsed.rows).toEqual([
      ["number", "BIGINT"],
      ["title", "VARCHAR"],
    ]);
  });

  it("infers column names from object rows when metadata is omitted", () => {
    const parsed = parseMotherduckSqlResponse({
      rows: [{ column_name: "number", data_type: "BIGINT" }],
    });
    expect(parsed.columns).toEqual(["column_name", "data_type"]);
    expect(parsed.rows[0]).toEqual(["number", "BIGINT"]);
  });
});

describe("motherduckScopedSql", () => {
  it("prefixes USE when database is set", () => {
    expect(motherduckScopedSql("eltpulse", 'SELECT 1')).toBe('USE "eltpulse";\nSELECT 1');
  });

  it("does not double-prefix USE", () => {
    expect(motherduckScopedSql("eltpulse", "USE other; SELECT 1")).toBe("USE other; SELECT 1");
  });
});

describe("motherduckQueryPayload", () => {
  it("uses API database field for catalog scoping (single statement)", () => {
    expect(motherduckQueryPayload("my_db", "SELECT 1")).toEqual({
      sql: "SELECT 1",
      database: "my_db",
    });
  });

  it("omits database attach when omitDatabase is set", () => {
    expect(motherduckQueryPayload("my_db", "SELECT 1", { omitDatabase: true })).toEqual({
      sql: "SELECT 1",
    });
  });

  it("skips database when SQL already USEs", () => {
    expect(motherduckQueryPayload("my_db", "USE other; SELECT 1")).toEqual({ sql: "USE other; SELECT 1" });
  });
});
